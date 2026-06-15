from typing import TypedDict, List, Dict, Annotated
import operator

class AgentState(TypedDict):
    # --- 1. Initial Input Data ---
    subject: str
    grade_level: int 
    original_topic_id: str
    failed_items: List[Dict[any]]       # failed items with wrong answers from the students and the actual answer
    lesson_context: str                 # the actual lesson that is stored in the database
    topic: str
    
    # --- 2. Context & Diagnosis (Carried over from the workflow logic) ---
    core_diagnosis: Dict[str, any]              # From DiagnoseMisconception
    
    # --- 3. The Automated AI Evaluation Loop ---
    draft_lesson: str
    evaluation_scores: Dict[str, int] # Stores the quantitative scores
    is_approved: bool # True if all scores >= 4, False if any score <= 3
    revision_remarks: str # The 2-3 sentence feedback for the generator
    revision_count: Annotated[int, operator.add] # Safely increments: 0 -> 1 -> 2
    
    # --- 4. Human-in-the-Loop (HITL) ---
    teacher_feedback: str            # The predefined button clicked (e.g., "Simplify Language")
    final_lesson: str