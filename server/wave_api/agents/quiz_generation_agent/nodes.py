from typing import TypedDict, Optional
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from .state import AgentState
from wave_api.agents.agent_factory import AgentFactory
from wave_api.agents.agent_role import AgentRole
from .output_schema import DiagnosisResult, QuizDraftResponse, QuizEvaluationResult
from .prompts.diagnostic_prompt import diagnosis_prompt
from .prompts.quiz_generation_prompt import quiz_generation_prompt
from .prompts.evaluation_prompt import quiz_evaluation_prompt
from .prompts.teacher_evaluation_prompts import prompt_make_harder, prompt_make_easier, prompt_change_context, prompt_fix_distractors
import json

llm_factory = AgentFactory()

# ==========================================
# 2. Define the Nodes (Automated AI Actions)
# ==========================================
def retrieve_context(state: AgentState):
    from wave_api.models import CatalogDocument

    print("--- [Node] Retrieving Context & catalog document ---")
    subject = state.get("subject", "science")
    topic_id = state.get("original_topic_id")
    
    lesson_context = state.get("lesson_context", "")

    try:
        catalog = CatalogDocument.objects.get(subject=subject)
        # Search the catalog data for the specific lesson/topic
        found = False
        for lesson in catalog.data:
            if lesson.get("id") == topic_id or lesson.get("title") == state.get("topic"):
                lesson_context = str(lesson)
                found = True
                break
            # Check if topics are nested inside lessons
            for topic in lesson.get("topics", []):
                if topic.get("id") == topic_id:
                    lesson_context = str(topic)
                    found = True
                    break
            if found:
                break
    except CatalogDocument.DoesNotExist:
        pass

    return {
        "context": "Retrieved context about the subject.",
        "lesson_context": lesson_context
    }

def diagnose(state: AgentState):
    print("--- [Node] Diagnosing Misconception ---")

    llm = llm_factory.create_llm(AgentRole.PRIMARY)
    # Bind the Pydantic schema to the model
    structured_llm = llm.with_structured_output(DiagnosisResult)
    
    # Create the chain
    chain = diagnosis_prompt | structured_llm
    
    result = chain.invoke({
        "subject": state.get("subject", ""),
        "grade_level": state.get("grade_level", ""),
        "topic": state.get("topic", ""),
        "lesson_context": state.get("lesson_context", ""),
        "failed_items": state.get("failed_items", [])
    })
    
    print(f"Diagnosed Core Issue: {result.primary_misunderstanding}")

    return {
        "core_diagnosis": result.model_dump()
    }

def draft_quiz(state: AgentState) -> dict:
    print("--- [Node] Drafting / Revising Quiz Material ---")
    
    # 1. Initialize the LLM with structured output
    primary_llm = llm_factory.create_llm(AgentRole.PRIMARY)
    structured_llm = primary_llm.with_structured_output(QuizDraftResponse)
    
    # 2. Extract shared core components from the graph state
    subject = state.get("subject")
    grade_level = state.get("grade_level")
    topic = state.get("topic")
    
    # Extract structural flag checks
    is_revision = state.get("is_revision", False)
    has_lesson_content = state.get("has_lesson_content", False)
    
    # Base payload parameters shared by ALL prompts (both Initial Generation and Revisions)
    payload = {
        "subject": subject,
        "grade_level": grade_level,
        "topic": topic
    }
    
    # 3. Handle Conditional Branching for Prompt Selection & Payload Configuration
    if is_revision:
        print("-> Processing Teacher Revision Pipeline (Omitting lesson context)")
        
        # Safely read the revision trigger configuration
        eval_remarks = state.get("eval_remarks", {})
        feedback_type = eval_remarks.get("feedback_type", "change_distractors") # Aligned fallback string
        feedback_text = state.get("human_feedback", "")
        
        # Route exclusively to templates expecting: subject, grade_level, topic, quiz_draft, human_feedback
        if feedback_type == "make_harder":
            selected_prompt = prompt_make_harder
        elif feedback_type == "make_easier":
            selected_prompt = prompt_make_easier
        elif feedback_type == "change_context":
            selected_prompt = prompt_change_context
        else:
            # Safe Fallback: Handles 'change_distractors' and any miscellaneous values cleanly
            selected_prompt = prompt_fix_distractors
            
        # Add revision payload variables
        payload["quiz_draft"] = json.dumps(state.get("quiz_draft", {}), indent=2)
        payload["human_feedback"] = feedback_text
        
    else:
        print("-> Processing Initial/Fresh Quiz Generation Pipeline")
        # Base generation configuration path
        selected_prompt = quiz_generation_prompt
        
        diagnosis_payload = state.get("core_diagnosis", {})
        payload["core_diagnosis"] = json.dumps(diagnosis_payload, indent=2)
        
        # Branch variables based on lesson content presence rules
        if has_lesson_content:
            print("--> Using 'remedial_lesson' as lesson context")
            payload["lesson_context"] = state.get("remedial_lesson", "")
        else:
            print("--> Using standard 'lesson_context' state data")
            payload["lesson_context"] = state.get("lesson_context", "")

    # 4. Bind and execute the designated chain
    chain = selected_prompt | structured_llm
    
    try:
        result: QuizDraftResponse = chain.invoke(payload)
        return {
            "quiz_draft": result.model_dump(),
            "human_feedback": None
            # Removed 'is_revision: False' so route_after_draft can successfully read the flag
        }
        
    except Exception as e:
        print(f"--- [Error] Exception during quiz drafting: {e} ---")
        return {
            "quiz_draft": state.get("quiz_draft", {})
        }

def eval_quiz(state: AgentState):
    print("--- [Node] Evaluating Quiz Logic ---")
    
    # 1. Track and increment attempts
    current_attempts = state.get("draft_attempts", 0) + 1
    MAX_ATTEMPTS = 3
    print(f"--- Evaluation Attempt: {current_attempts} / {MAX_ATTEMPTS} ---")
    
    primary_llm = llm_factory.create_llm(AgentRole.PRIMARY)
    structured_evaluator = primary_llm.with_structured_output(QuizEvaluationResult)
    
    chain = quiz_evaluation_prompt | structured_evaluator
    
    # 2. Format entire state objects directly into strings for the prompt
    core_diagnosis_str = json.dumps(state.get("core_diagnosis", {}), indent=2)
    # No extraction needed—just stringify the entire current dictionary state
    quiz_draft_str = json.dumps(state.get("quiz_draft", {}), indent=2)
    
    try:
        # 3. Invoke the evaluation
        evaluation = chain.invoke({
            "subject": state.get("subject"),
            "grade_level": state.get("grade_level"),
            "topic": state.get("topic"),
            "lesson_context": state.get("lesson_context"),
            "core_diagnosis": core_diagnosis_str,
            "quiz_draft": quiz_draft_str
        })
        
        # 4. Extract the 1-5 scores into a standard dictionary
        score_dict = evaluation.scores.model_dump()
        print(f"Scores Evaluated: {score_dict}")
        
        # 5. Python-Enforced Gatekeeping
        failed_criteria = [criteria for criteria, score in score_dict.items() if score < 3]
        
        # Package the raw evaluation data into a single consolidated state variable
        eval_remarks_data = {
            "scores": score_dict,
            "eval_status": "FAIL" if failed_criteria else "PASS",
            "critique_summary": evaluation.critique_summary,
            "revisions_required": evaluation.revisions_required,
            "failed_criteria": failed_criteria,
            "attempt_number": current_attempts
        }
        
        if failed_criteria:
            print(f"[Guardrail Override] Quiz FAILED due to scores < 3 in: {failed_criteria}")
            
            feedback_notes = f"Psychometric Audit Failures (Substandard scores in {failed_criteria}):\n" + \
                             "\n".join(f"- {item}" for item in evaluation.revisions_required)
            
            if current_attempts >= MAX_ATTEMPTS:
                print("--- [Guardrail] Max attempts reached. Halting improvement loop. ---")
                eval_remarks_data["eval_status"] = "MAX_ATTEMPTS_REACHED"
                return {
                    "eval_status": "MAX_ATTEMPTS_REACHED",
                    "human_feedback": f"Maximum attempts ({MAX_ATTEMPTS}) reached. Final feedback:\n{feedback_notes}",
                    "eval_remarks": eval_remarks_data,
                    "draft_attempts": current_attempts
                }
            
            return {
                "eval_status": "FAIL",
                "human_feedback": feedback_notes,
                "eval_remarks": eval_remarks_data,
                "draft_attempts": current_attempts
            }
            
        else:
            print("[Guardrail Passed] All criteria met the minimum threshold of 3.")
            return {
                "eval_status": "PASS",
                "human_feedback": None,
                "eval_remarks": eval_remarks_data,
                # Since we pass the whole structure, we pass the clean draft forward
                "final_quiz": state.get("quiz_draft"), 
                "draft_attempts": current_attempts
            }
            
    except Exception as e:
        print(f"--- [Error] Exception during quiz evaluation: {e} ---")
        
        error_remarks = {
            "system_error": str(e), 
            "eval_status": "ERROR",
            "attempt_number": current_attempts
        }
        
        if current_attempts >= MAX_ATTEMPTS:
            return {
                "eval_status": "MAX_ATTEMPTS_REACHED",
                "human_feedback": "System Error: Max attempts reached due to evaluation engine failure.",
                "eval_remarks": error_remarks,
                "draft_attempts": current_attempts
            }

        return {
            "eval_status": "FAIL",
            "human_feedback": "System Error: The evaluation engine encountered an issue. Please re-draft.",
            "eval_remarks": error_remarks,
            "draft_attempts": current_attempts
        }

def review_quiz(state: AgentState):
    # This node acts as a landing pad for the human-in-the-loop.
    # The graph will be paused BEFORE executing this node.
    print("--- [Node] Teacher Reviewing Quiz ---")
    # State is already updated by the human before resuming.
    # Set is_revision=True when teacher gives revision feedback so that
    # route_after_draft skips AI eval and sends the revised draft straight
    # back to the teacher for review.
    feedback = state.get("human_feedback", "")
    if feedback and feedback.lower() not in ("approve", "pass"):
        return {"is_revision": True}
    return {"is_revision": False}

def finalize_quiz(state: AgentState):
    print("--- [Node] Finalizing Quiz ---")
    from wave_api.models import RemediationMaterial
    import uuid
    from datetime import datetime

    approved_quiz = state.get("quiz_draft", [])

    # Save the approved quiz draft into the RemediationMaterial database model
    material_id = str(uuid.uuid4())
    RemediationMaterial.objects.create(
        material_id=material_id,
        subject=state.get("subject", "science"),
        original_topic_id=state.get("original_topic_id", ""),
        title=f"Remediation Quiz: {state.get('topic')}",
        created_quiz=approved_quiz,
        publish_date=datetime.now().strftime("%Y-%m-%d"),
        is_published=True
    )

    return {"final_quiz": approved_quiz}

# ==========================================
# 3. Define the Routing Logic (Conditional Edges)
# ==========================================
def route_initial_check(state: AgentState):
    """Router: CheckLesson"""
    if state.get("has_lesson_content"):
        return "draft_quiz"
    return "retrieve_context"

def route_after_eval(state: AgentState):
    """Router: EvalQuiz"""
    status = state.get("eval_status", "FAIL")
    if status == "PASS" or status == "MAX_ATTEMPTS_REACHED":
        return "review_quiz"
    return "draft_quiz" # Loop back if FAIL

def route_after_human_review(state: AgentState):
    """
    Router: ReviewQuiz logic
    If the teacher approves, go to finalize.
    If the teacher gives any other feedback, loop back to draft_quiz.
    """
    feedback = state.get("human_feedback", "")
    
    if not feedback:
        return "draft_quiz"
        
    if feedback.lower() == "approve" or feedback.lower() == "pass":
        return "finalize_quiz"

    return "draft_quiz"

def route_after_draft(state: AgentState):
    """
    Router: Decides where to send the quiz after it's drafted.
    If it's processing Teacher Feedback, skip AI evaluation and go straight to the teacher.
    """
    # Note: In your draft_quiz node, you clear human_feedback at the very end.
    # To make this router work, you must preserve the feedback or use a flag like 'is_revision'.
    if state.get("is_revision"):
        return "review_quiz"
    return "eval_quiz"

# ==========================================
# Full Graph Compilation
# ==========================================
workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("retrieve_context", retrieve_context)
workflow.add_node("diagnose", diagnose)
workflow.add_node("draft_quiz", draft_quiz)
workflow.add_node("eval_quiz", eval_quiz)      # <-- Restored evaluation node
workflow.add_node("review_quiz", review_quiz)  # Teacher sits here
workflow.add_node("finalize_quiz", finalize_quiz)

# START -> CheckLesson Router
workflow.add_conditional_edges(START, route_initial_check, {
    "retrieve_context": "retrieve_context",
    "draft_quiz": "draft_quiz"
})

# Context Pipeline
workflow.add_edge("retrieve_context", "diagnose")
workflow.add_edge("diagnose", "draft_quiz")

# Draft -> Router (Eval or Skip to Human)
workflow.add_conditional_edges("draft_quiz", route_after_draft, {
    "eval_quiz": "eval_quiz",
    "review_quiz": "review_quiz"
})

# Eval -> Router (Pass to Human or Fail to Draft)
workflow.add_conditional_edges("eval_quiz", route_after_eval, {
    "review_quiz": "review_quiz",
    "draft_quiz": "draft_quiz"
})

# Teacher Gatekeeper Edge
workflow.add_conditional_edges("review_quiz", route_after_human_review, {
    "finalize_quiz": "finalize_quiz",
    "draft_quiz": "draft_quiz"  # Loops back directly to draft, which points back to review
})

workflow.add_edge("finalize_quiz", END)

# ==========================================
# 5. Compile with Checkpointer (for Pausing)
# ==========================================
memory = MemorySaver()
# We interrupt BEFORE the "review_quiz" node so the teacher can inject feedback
graph = workflow.compile(checkpointer=memory, interrupt_before=["review_quiz"])