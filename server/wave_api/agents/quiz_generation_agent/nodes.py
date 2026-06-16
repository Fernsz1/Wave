from typing import TypedDict, Optional
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from .state import AgentState
from server.wave_api.agents.agent_factory import AgentFactory
from .output_schema import DiagnosisResult, QuizDraftResponse, QuizEvaluationResult
from .prompts.diagnostic_prompt import diagnosis_prompt
from .prompts.quiz_generation_prompt import quiz_generation_prompt
from .prompts.evaluation_prompt import quiz_evaluation_prompt
import json

llm_factory = AgentFactory()

# ==========================================
# 2. Define the Nodes (Automated AI Actions)
# ==========================================
def retrieve_context(state: AgentState):
    print("--- [Node] Retrieving Context ---")
    # Add your vector DB / RAG logic here
    return {"context": "Retrieved context about the subject."}

def diagnose(state: AgentState):
    print("--- [Node] Diagnosing Misconception ---")

    llm = llm_factory.create_llm("primary")
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
    print("--- [Node] Drafting Quiz & Distractor Rationale ---")
    
    # 1. Initialize the primary model with structured output matching your Pydantic schema
    # A low temperature (e.g., 0.2) keeps item generation highly focused on psychometric constraints
    primary_llm = llm_factory.create_llm("primary")
    structured_llm = primary_llm.with_structured_output(QuizDraftResponse)
    
    # 2. Extract core components from the graph state
    subject = state["subject"]
    grade_level = state["grade_level"]
    topic = state["topic"]
    lesson_context = state["lesson_context"]
    
    # Prepare the core diagnosis payload to inject into the prompt
    diagnosis_payload = state.get("core_diagnosis", {})
    core_diagnosis_str = json.dumps(diagnosis_payload, indent=2)
    
    # 3. Handle human or AI evaluation feedback loops
    feedback = state.get("human_feedback", "")
    if feedback:
        print(f"Applying revision instructions: {feedback}")
        # Append the feedback explicitly to the core diagnosis context to force a rewrite adjustments
        core_diagnosis_str += f"\n\n[CRITICAL REVISION INSTRUCTIONS]:\n{feedback}"

    # 4. Assemble and execute the generation chain
    chain = quiz_generation_prompt | structured_llm
    
    try:
        result: QuizDraftResponse = chain.invoke({
            "subject": subject,
            "grade_level": grade_level,
            "topic": topic,
            "lesson_context": lesson_context,
            "core_diagnosis": core_diagnosis_str
        })
        
        # 5. Convert Pydantic objects back into a standard list of raw dictionaries
        formatted_quiz_list = [item.model_dump() for item in result.quiz_items]
        
        print(f"Successfully generated draft containing {len(formatted_quiz_list)} items.")
        
        # 6. Update the LangGraph state keys
        return {
            "quiz_draft": formatted_quiz_list,
            # Clear out the feedback channel once consumed to prevent stuck loops
            "human_feedback": None 
        }
        
    except Exception as e:
        print(f"--- [Error] Exception during quiz drafting: {e} ---")
        # Fail-safe state fallback
        return {
            "quiz_draft": []
        }

def eval_quiz(state: AgentState):
    print("--- [Node] Evaluating Quiz Logic ---")
    
    primary_llm = llm_factory.create_llm("primary")
    structured_evaluator = primary_llm.with_structured_output(QuizEvaluationResult)
    
    chain = quiz_evaluation_prompt | structured_evaluator
    
    # 3. Format state data into strings for the prompt
    core_diagnosis_str = json.dumps(state.get("core_diagnosis", {}), indent=2)
    quiz_draft_str = json.dumps(state.get("quiz_draft", []), indent=2)
    
    try:
        # 4. Invoke the evaluation
        evaluation = chain.invoke({
            "subject": state["subject"],
            "grade_level": state["grade_level"],
            "topic": state["topic"],
            "lesson_context": state["lesson_context"],
            "core_diagnosis": core_diagnosis_str,
            "quiz_draft": quiz_draft_str
        })
        
        # 5. Extract the 1-5 scores into a standard dictionary
        score_dict = evaluation.scores.model_dump()
        print(f"Scores Evaluated: {score_dict}")
        
        # 6. Python-Enforced Gatekeeping (The Guardrail)
        # Identify any criterion that scored a 1 or 2
        failed_criteria = [criteria for criteria, score in score_dict.items() if score < 3]
        
        if failed_criteria:
            print(f"[Guardrail Override] Quiz FAILED due to scores < 3 in: {failed_criteria}")
            
            # Compile actionable feedback for the drafting node to use on the next loop
            feedback_notes = f"Psychometric Audit Failures (Substandard scores in {failed_criteria}):\n" + \
                             "\n".join(f"- {item}" for item in evaluation.revisions_required)
            
            return {
                "eval_status": "FAIL",
                "human_feedback": feedback_notes
            }
            
        else:
            print("[Guardrail Passed] All criteria met the minimum threshold of 3.")
            
            # If it passes, clear any lingering feedback and promote the draft to final
            return {
                "eval_status": "PASS",
                "human_feedback": None,
                "final_quiz": state.get("quiz_draft") 
            }
            
    except Exception as e:
        print(f"--- [Error] Exception during quiz evaluation: {e} ---")
        # Fail-safe: If the API call fails or parsing breaks, reject the draft to prevent bad data from advancing
        return {
            "eval_status": "FAIL",
            "human_feedback": "System Error: The evaluation engine encountered an issue. Please review the draft or re-trigger."
        }

def review_quiz(state: AgentState):
    # This node acts as a landing pad for the human-in-the-loop.
    # The graph will be paused BEFORE executing this node.
    print("--- [Node] Teacher Reviewing Quiz ---")
    # State is already updated by the human before resuming.
    return {}

def finalize_quiz(state: AgentState):
    print("--- [Node] Finalizing Quiz ---")
    return {"final_quiz": "Final Output: " + str(state.get("quiz_draft"))}

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
    if status == "PASS":
        return "review_quiz"
    return "draft_quiz" # Loop back if FAIL

def route_after_human_review(state: AgentState):
    """Router: ReviewQuiz logic"""
    feedback = state.get("human_feedback", "")
    if feedback.lower() == "approve":
        return "finalize_quiz"
    # Otherwise (Make Harder / Easier / Modify Context) loop back to draft
    return "draft_quiz"

# ==========================================
# 4. Build the Graph
# ==========================================
workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("retrieve_context", retrieve_context)
workflow.add_node("diagnose", diagnose)
workflow.add_node("draft_quiz", draft_quiz)
workflow.add_node("eval_quiz", eval_quiz)
workflow.add_node("review_quiz", review_quiz)
workflow.add_node("finalize_quiz", finalize_quiz)

# Add Edges
# START -> CheckLesson Router
workflow.add_conditional_edges(START, route_initial_check, {
    "retrieve_context": "retrieve_context",
    "draft_quiz": "draft_quiz"
})

# Needs Context Track
workflow.add_edge("retrieve_context", "diagnose")
workflow.add_edge("diagnose", "draft_quiz")

# Quiz AI Loop
workflow.add_edge("draft_quiz", "eval_quiz")
workflow.add_conditional_edges("eval_quiz", route_after_eval, {
    "review_quiz": "review_quiz",
    "draft_quiz": "draft_quiz"
})

# Human-in-the-Loop Edge
workflow.add_conditional_edges("review_quiz", route_after_human_review, {
    "finalize_quiz": "finalize_quiz",
    "draft_quiz": "draft_quiz"
})

# End Edge
workflow.add_edge("finalize_quiz", END)

# ==========================================
# 5. Compile with Checkpointer (for Pausing)
# ==========================================
memory = MemorySaver()
# We interrupt BEFORE the "review_quiz" node so the teacher can inject feedback
graph = workflow.compile(checkpointer=memory, interrupt_before=["review_quiz"])