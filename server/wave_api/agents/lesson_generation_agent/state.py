from typing import TypedDict, List, Dict, Any, Annotated
import operator

class AgentState(TypedDict):
    # --- 1. Initial Input Data ---
    subject: str
    grade_level: int
    original_topic_id: str
    failed_items: List[Dict[str, Any]]  # failed items with wrong answers from the students and the actual answer
    lesson_context: str                 # the actual lesson that is stored in the database
    topic: str
    teacher_recommendations: str
    learning_gap: str

    # --- 2. Context & Diagnosis (Carried over from the workflow logic) ---
    core_diagnosis: Dict[str, Any]              # From DiagnoseMisconception

    # --- 3. The Automated AI Evaluation Loop ---
    draft_lesson: Dict[str, Any]                # {title, content, teacher_notes} per RemediationDraftResponse
    evaluation_scores: Dict[str, int]           # Stores the quantitative scores
    is_approved: bool                           # True if all scores >= 4, False if any score <= 3
    revision_remarks: str                       # The 2-3 sentence feedback for the generator
    revision_count: Annotated[int, operator.add]

    # --- 4. Human-in-the-Loop (HITL) ---
    teacher_feedback: str                       # The predefined button clicked (e.g., "Simplify Language")
    final_lesson: Dict[str, Any]
    teacher_revisions: Annotated[int, operator.add]