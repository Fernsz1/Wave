from typing import TypedDict, Optional
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from .state import AgentState
from server.wave_api.agents.agent_factory import AgentFactory
from .output_schema import DiagnosisResult
from .prompts.diagnostic_prompt import diagnosis_prompt

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

def draft_quiz(state: AgentState):
    print("--- [Node] Drafting Quiz & Distractor Rationale ---")
    # Incorporate context, misconception, and any human feedback
    feedback = state.get("human_feedback", "")
    prefix = f"Refined with feedback: {feedback} | " if feedback else ""
    return {"quiz_draft": f"{prefix}Drafted Quiz Question 1..."}

def eval_quiz(state: AgentState):
    print("--- [Node] Evaluating Quiz Logic ---")
    # Add LLM logic to evaluate if the quiz is logically sound
    # For demonstration, we'll just mock it as passing.
    return {"eval_status": "PASS"} 

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