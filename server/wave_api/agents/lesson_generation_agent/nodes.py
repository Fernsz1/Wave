from server.wave_api.agents.agent_factory import AgentFactory
from server.wave_api.agents.lesson_generation_agent.state import AgentState
from server.wave_api.agents.lesson_generation_agent.prompts.diagnostic_prompt import diagnosis_prompt
from server.wave_api.agents.lesson_generation_agent.prompts.remediation_prompt import remediation_prompt
from server.wave_api.agents.lesson_generation_agent.prompts.teacher_remediation_prompt import  simplify_prompt, practical_prompt, change_exercise_prompt, micro_steps_prompt
from server.wave_api.agents.lesson_generation_agent.prompts.evaluation_prompt import remediation_evaluation_prompt
from langchain_core.output_parsers import JsonOutputParser 
from pydantic import BaseModel, Field
from server.wave_api.agents.lesson_generation_agent.output_schema import RemediationEvaluationResult, RemediationScores
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from dotenv import load_dotenv
load_dotenv()


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
    if state['teacher_feedback'] == '':
        chain = remediation_prompt | primary_llm | JsonOutputParser()
        remediation_material = chain.invoke({
            "subject": state.get("subject"),
            "grade_level": state.get("grade_level"),
            "topic": state.get("topic"),
            "lesson_context": state.get("lesson_context"),
            # The diagnosis_report variable gets the JSON output saved by your previous node
            "diagnosis_report": state.get("core_diagnosis")
        })
    else:
        match state['teacher_feedback']:
            case "simplify":
                prompt = simplify_prompt
            case "practical":
                prompt = practical_prompt
            case "change":
                prompt = change_exercise_prompt
            case "micro":
                prompt = micro_steps_prompt

        chain = prompt | primary_llm | JsonOutputParser()
        remediation_material = chain.invoke({
            "subject": state['subject'],
            "grade_level": state['grade_level'],
            "topic": state['topic'],
            "diagnosis_report": state["core_diagnosis"],
            "draft_lesson": state['draft_lesson']
        })

    return {
        "draft_lesson": remediation_material,
        "revision_count": 1 # Because of Annotated[..., operator.add], this increments the counter
    }

def evaluate_pedagogy(state: AgentState):
    """Evaluates the drafted prompt and stops after a max number of revisions to prevent infinite loops."""

    current_revisions = state.get("revision_count", 0)
    max_revisions = 3

    if current_revisions >= max_revisions or is_approved:
        return state

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
    """Serve as a pausing state waiting for the teacher's response"""
    return state

def teacher_finalize(state: AgentState):
    """
    Finalizes the lesson after human approval.
    This is the last node executed before the graph reaches the END.
    """

    # 1. Grab the currently approved draft (whether it was the first AI draft or a human-modified one)
    approved_lesson = state.get("draft_lesson")
    # 3. Return the final state updates
    return {
        # Lock in the final lesson
        "final_lesson": approved_lesson,
    }


# --- 3. Edge Routing Logic ---

def automated_review_router(state: AgentState):
    verdict = state.get("is_approved")
    if verdict == "PASS":
        return "TeacherReview"
    return "DraftLesson"

def human_review_router(state: AgentState):
    feedback = state.get("teacher_feedback", "")
    if feedback != "PASS":
        return "DraftLesson"
    return "TeacherFinalize" 



workflow = StateGraph(AgentState)
workflow.add_node("RetrieveLocalContext", retrieve_local_context)
workflow.add_node("DiagnoseMisconception", diagnose_misconception)
workflow.add_node("DraftLesson", draft_lesson)
workflow.add_node("EvaluatePedagogy", evaluate_pedagogy)
workflow.add_node("TeacherReview", teacher_review)
workflow.add_node("TeacherFinalize", teacher_finalize)

# 4. Add the Standard Linear Edges
workflow.add_edge(START, "RetrieveLocalContext")
workflow.add_edge("RetrieveLocalContext", "DiagnoseMisconception")
workflow.add_edge("DiagnoseMisconception", "DraftLesson")
workflow.add_edge("DraftLesson", "EvaluatePedagogy")

# 5. Add the Conditional Edge for Automated AI Review
workflow.add_conditional_edges(
    "EvaluatePedagogy",
    automated_review_router,
    {
        # Map the router's string output to the actual node names
        "TeacherReview": "TeacherReview",
        "DraftLesson": "DraftLesson"
    }
)

# 6. Add the Conditional Edge for Human (Teacher) Review
workflow.add_conditional_edges(
    "TeacherReview",
    human_review_router,
    {
        "TeacherFinalize": "TeacherFinalize",
        "DraftLesson": "DraftLesson"
    }
)

# 7. Add the Final Edge
workflow.add_edge("TeacherFinalize", END)

# 8. Compile the Graph
# We need a checkpointer (MemorySaver) to save the state when the graph pauses for the teacher.
memory = MemorySaver()

# interrupt_before=["TeacherReview"] tells the graph to completely halt execution 
# right before it enters the TeacherReview node, allowing your API/Frontend to ask the user.
workflow_app = workflow.compile(
    checkpointer=memory,
    interrupt_before=["TeacherReview"]
)
