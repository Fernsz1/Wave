from typing import Any, Dict, List, Optional, TypedDict


class AgentState(TypedDict):
    subject: Optional[str]
    grade_level: Optional[int]
    original_topic_id: Optional[str]
    failed_items: Optional[List[Dict[str, Any]]]  # wrong-answer payloads from the students
    lesson_context: Optional[str]                 # the actual lesson stored in the database
    topic: Optional[str]

    core_diagnosis: Optional[Dict[str, Any]]
    remedial_lesson: Optional[str]
    has_lesson_content: bool
    is_revision: bool                             # True when processing teacher revision feedback
    quiz_draft: Optional[List[Dict[str, Any]]]
    eval_status: Optional[str]   # "PASS", "FAIL", or "MAX_ATTEMPTS_REACHED"
    eval_remarks: Optional[Dict[str, Any]]        # Consolidated evaluation data from eval_quiz
    draft_attempts: int                           # Number of draft/eval cycles completed
    human_feedback: Optional[str]
    final_quiz: Optional[Any]

