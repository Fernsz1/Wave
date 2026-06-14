from agents.agent_factory import AgentFactory
from agents.lesson_generation_agent.state import AgentState
from server.wave_api.agents.lesson_generation_agent.prompts.diagnostic_prompt import diagnosis_prompt
from langchain_core.output_parsers import JsonOutputParser 

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
    
    chain = diagnosis_prompt | primary_llm | JsonOutputParser()
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
    # Automated Editor
    print("-> Evaluating pedagogy...")
    
    # Mocking an automated failure on the first pass to demonstrate the loop
    if state.get("revision_count", 0) < 2:
        return {
            "reviewer_verdict": "FAIL", 
            "critique": "The analogy is slightly confusing. Simplify it."
        }
    
    return {"reviewer_verdict": "PASS"}

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