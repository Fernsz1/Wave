from wave_api.agents.agent_factory import AgentFactory
from wave_api.agents.agent_role import AgentRole
from wave_api.agents.lesson_generation_agent.state import AgentState
from wave_api.agents.lesson_generation_agent.prompts.diagnostic_prompt import diagnosis_prompt
from wave_api.agents.lesson_generation_agent.prompts.remediation_prompt import remediation_prompt
from wave_api.agents.lesson_generation_agent.prompts.teacher_remediation_prompt import simplify_prompt, practical_prompt, change_exercise_prompt, micro_steps_prompt
from wave_api.agents.lesson_generation_agent.prompts.evaluation_prompt import remediation_evaluation_prompt
from langchain_core.output_parsers import JsonOutputParser 
from pydantic import BaseModel, Field
from wave_api.agents.lesson_generation_agent.output_schema import RemediationEvaluationResult, RemediationLesson
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from .output_schema import StudentDiagnosis
from dotenv import load_dotenv
load_dotenv()


llm_factory = AgentFactory()
primary_llm = llm_factory.create_llm(AgentRole.PRIMARY)
evaluator_llm = llm_factory.create_llm(AgentRole.EVALUATOR)

# --- 2. Node Functions (The "Doers") ---
def retrieve_local_context(state: AgentState):
    from wave_api.models import CatalogDocument

    print("-> Retrieving local cultural context & catalog document...")
    subject = state.get("subject", "science")
    topic_id = state.get("original_topic_id")
    
    lesson_content = state.get("lesson_context", "")

    try:
        catalog = CatalogDocument.objects.get(subject=subject)
        # Search the catalog data for the specific lesson/topic
        found = False
        for lesson in catalog.data:
            if lesson.get("id") == topic_id or lesson.get("title") == state.get("topic"):
                lesson_content = str(lesson)
                found = True
                break
            # Check if topics are nested inside lessons
            for topic in lesson.get("topics", []):
                if topic.get("id") == topic_id:
                    lesson_content = str(topic)
                    found = True
                    break
            if found:
                break
    except CatalogDocument.DoesNotExist:
        pass

    return {
        "local_analogy_context": "Found local cultural analogy relevant to the syllabus.",
        "lesson_context": lesson_content
    }

def diagnose_misconception(state: AgentState):
    """Creates class diagnosis to know what steps should be taken to improve classroom performance"""

    structured_llm = primary_llm.with_structured_output(StudentDiagnosis)
    
    chain = diagnosis_prompt | structured_llm
    
    result = chain.invoke({
        "subject": state["subject"],
        "grade_level": state["grade_level"],
        "topic": state["topic"],
        "lesson_context": state["lesson_context"],
        "failed_items": state["failed_items"]
    })
    
    # 4. Convert the Pydantic object back into a dictionary for the state
    return {"core_diagnosis": result.model_dump()}

def draft_lesson(state: AgentState):
    """Creates remediation material based upon the lesson and the diagnosis of students' performance"""
    if state['teacher_feedback'] == '':
        # 1. Bind the structure to your LLM
        structured_llm = primary_llm.with_structured_output(RemediationLesson)

        # 2. Create the chain
        chain = remediation_prompt | structured_llm

        # 3. Invoke the chain using your state variables
        remediation_material = chain.invoke({
            "subject": state.get("subject"),
            "grade_level": state.get("grade_level"),
            "topic": state.get("topic"),
            "lesson_context": state.get("lesson_context"),
            "diagnosis_report": state.get("core_diagnosis"), 
            "recommendations": state.get("teacher_recommendations"),
            "learning_gap": state.get("learning_gap")
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
            case _:
                prompt = simplify_prompt  # safe fallback for unexpected values

        chain = prompt | primary_llm | JsonOutputParser()
        remediation_material = chain.invoke({
            "subject": state['subject'],
            "grade_level": state['grade_level'],
            "topic": state['topic'],
            "diagnosis_report": state["core_diagnosis"],
            "draft_lesson": state['draft_lesson'],
            "recommendations": state.get("teacher_recommendations"),
            "learning_gap": state.get("learning_gap")
        })

    # Normalize Pydantic models to dict for consistent state handling.
    # The initial path returns a RemediationLesson Pydantic object while
    # the teacher-feedback path returns a plain dict from JsonOutputParser.
    # Downstream nodes (evaluate_pedagogy, teacher_finalize) use .get()
    # which only works on dicts.
    if hasattr(remediation_material, 'model_dump'):
        remediation_material = remediation_material.model_dump()

    return {
        "draft_lesson": remediation_material,
        "revision_count": 1 # Because of Annotated[..., operator.add], this increments the counter
    }

def evaluate_pedagogy(state: AgentState):
    """Evaluates the drafted prompt and stops after a max number of revisions to prevent infinite loops."""

    current_revisions = state.get("revision_count", 0)
    max_revisions = 3

    if state.get("is_approved"):
        # Return empty dict (no-op) instead of the full state to avoid
        # doubling revision_count via the Annotated[int, operator.add] reducer.
        return {}

    structured_evaluator = evaluator_llm.with_structured_output(RemediationEvaluationResult)
    chain = remediation_evaluation_prompt | structured_evaluator

    result: RemediationEvaluationResult = chain.invoke({
        "grade_level": state.get("grade_level"),
        "topic": state.get("topic"),
        "core_diagnosis": state.get("core_diagnosis"),
        "learning_gap": state.get("learning_gap"),
        "draft_lesson": state.get("draft_lesson"),
        "recommendations": state.get("teacher_recommendations", "")
    })

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
    from wave_api.models import RemediationMaterial
    import uuid
    from datetime import datetime

    # 1. Grab the currently approved draft (whether it was the first AI draft or a human-modified one)
    approved_lesson = state.get("draft_lesson", {})

    # 2. Save the approved draft into the RemediationMaterial database model
    material_id = str(uuid.uuid4())
    RemediationMaterial.objects.create(
        material_id=material_id,
        subject=state.get("subject", "science"),
        original_topic_id=state.get("original_topic_id", ""),
        title=approved_lesson.get("title", f"Remediation: {state.get('topic')}"),
        content=approved_lesson.get("content", ""),
        teacher_notes=approved_lesson.get("teacher_notes", ""),
        publish_date=datetime.now().strftime("%Y-%m-%d"),
        is_published=True
    )

    # 3. Return the final state updates
    return {
        # Lock in the final lesson
        "final_lesson": approved_lesson,
    }


# --- 3. Edge Routing Logic ---

def automated_review_router(state: AgentState):
    if state.get("is_approved"):
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
