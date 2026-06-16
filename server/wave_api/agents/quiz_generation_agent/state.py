from typing import TypedDict, Optional, List, Dict

class AgentState(TypedDict):
    subject: str
    grade_level: int 
    original_topic_id: str
    failed_items: List[Dict[any]]       # failed items with wrong answers from the students and the actual answer
    lesson_context: str                 # the actual lesson that is stored in the database
    topic: str

    core_diagnosis: Dict[str, any]      


    has_lesson_content: bool
    quiz_draft: Optional[List[Dict, any]]
    eval_status: Optional[str] # "PASS" or "FAIL"
    human_feedback: Optional[str] # "Approve", or feedback like "Make Harder"
    final_quiz: Optional[str]
