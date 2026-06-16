from typing import TypedDict, Optional, List, Dict

class AgentState(TypedDict):
    subject: Optional[str]
    grade_level: Optional[int]
    original_topic_id: Optional[str]
    failed_items: Optional[List[Dict[any]]]       # failed items with wrong answers from the students and the actual answer
    lesson_context: Optional[str]                 # the actual lesson that is stored in the database
    topic: Optional[str]

    core_diagnosis: Optional[Dict[str, any]]      
    remedial_lesson: Optional[str]

    has_lesson_content: bool
    quiz_draft: Optional[List[Dict, any]]
    eval_status: Optional[str] # "PASS" or "FAIL"
    human_feedback: Optional[str] # "Approve", or feedback like "Make Harder"
    final_quiz: Optional[str]
