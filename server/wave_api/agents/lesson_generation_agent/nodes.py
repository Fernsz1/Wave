from server.wave_api.agents.agent_factory import AgentFactory
from server.wave_api.agents.lesson_generation_agent.state import AgentState
from server.wave_api.agents.lesson_generation_agent.prompts.diagnostic_prompt import diagnosis_prompt
from server.wave_api.agents.lesson_generation_agent.prompts.remediation_prompt import remediation_prompt
from server.wave_api.agents.lesson_generation_agent.prompts.evaluation_prompt import remediation_evaluation_prompt
from langchain_core.output_parsers import JsonOutputParser 
from pydantic import BaseModel, Field
from server.wave_api.agents.lesson_generation_agent.output_schema import RemediationEvaluationResult, RemediationScores

llm_factory = AgentFactory()
primary_llm = llm_factory.create_llm("primary")
evaluator_llm = llm_factory.create_llm("evaluator")

# --- 2. Node Functions (The "Doers") ---
def retrieve_local_context(state: AgentState):
    print("-> Retrieving local cultural context...")
    return {"local_analogy_context": "Found local cultural analogy relevant to the syllabus."}

def diagnose_misconception(state: AgentState):
    """Creates class diagnosis to know what steps should be taken to improve classroom performance"""

    chain = diagnosis_prompt | primary_llm | JsonOutputParser()
    result = chain.invoke({
        "subject": state["subject"],
        "grade_level": state["grade_level"],
        "topic": state["topic"],
        "lesson_context": state["lesson_context"],
        "failed_items": state["failed_items"]
    })
    return {"core_diagnosis": result}

def draft_lesson(state: AgentState):
    """Creates remediation material based upon the lesson and the diagnosis of students' performance"""
    
    chain = remediation_prompt | primary_llm | JsonOutputParser()
    remediation_material = chain.invoke({
        "subject": state.get("subject"),
        "grade_level": state.get("grade_level"),
        "topic": state.get("topic"),
        "lesson_context": state.get("lesson_context"),
        # The diagnosis_report variable gets the JSON output saved by your previous node
        "diagnosis_report": state.get("core_diagnosis")
    })
    
    return {
        "draft_lesson": remediation_material,
        "revision_count": 1 # Because of Annotated[..., operator.add], this increments the counter
    }

def evaluate_pedagogy(state: AgentState):
    """Evaluates the drafted prompt and stops after a max number of revisions to prevent infinite loops."""

    # 1. Run the LLM evaluation
    evaluator_llm = llm_factory.create_llm("evaluator")
    chain = remediation_evaluation_prompt | evaluator_llm
    
    result: RemediationEvaluationResult = chain.invoke({
        "grade_level": state.get("grade_level"),
        "topic": state.get("topic"),
        "core_diagnosis": state.get("core_diagnosis"),
        "draft_lesson": state.get("draft_lesson")
    })
    
    # 2. Extract the LLM's natural findings
    is_approved = result.is_approved
    remarks = result.remarks
    
    current_revisions = state.get("revision_count", 0)
    max_revisions = 3
    
    if not is_approved and current_revisions >= max_revisions:
        print(f"⚠️ Max revisions ({max_revisions}) reached. Forcing approval to break loop.")
        is_approved = True 
        remarks = f"Max revision limit ({max_revisions}) reached. Proceeding with the best available draft. Original AI critique: {result.remarks}"

    return {
        "evaluation_scores": result.scores.model_dump(),
        "is_approved": is_approved,
        "revision_remarks": remarks
    }

def teacher_review(state: AgentState):
    # This node acts as a passthrough to finalize the state after the human intervenes
    print("-> Teacher review complete. Finalizing lesson...")
    return {"final_lesson": state.get("draft_lesson")}

# --- 3. Edge Routing Logic ---

def automated_review_router(state: AgentState):
    verdict = state.get("reviewer_verdict")
    if verdict == "PASS":
        return "TeacherReview"
    return "DraftLesson"

def human_review_router(state: AgentState):
    feedback = state.get("teacher_feedback", "")
    if feedback == "Approve" or feedback == "":
        return END
    return "DraftLesson"