from typing import TypedDict, Optional, List, Dict, Any

class AgentState(TypedDict):
    subject: Optional[str]
    grade_level: Optional[int]
    original_topic_id: Optional[str]
    failed_items: Optional[List[Dict[str, Any]]]
    lesson_context: Optional[str]                
    topic: Optional[str]

    core_diagnosis: Optional[Dict[str, Any]]      
    remedial_lesson: Optional[str]
    has_lesson_content: bool
    
    # Just the current draft. No history tracking.
    quiz_draft: Optional[Dict[str, Any]]
    
    # Will hold the full dump of QuizEvaluationResult
    eval_remarks: Dict[str, Any]
    draft_attempts: Optional[int]
    is_revision: Optional[bool]

    human_feedback: Optional[str] 
    final_quiz: Optional[List[Dict[str, Any]]]