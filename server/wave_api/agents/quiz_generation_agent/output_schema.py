from pydantic import BaseModel, Field, Dict
from typing import List 

class DiagnosisResult(BaseModel):
    topic: str = Field(description="The topic of the lesson.")
    primary_misunderstanding: str = Field(description="The primary misunderstanding driving the majority of errors.")
    common_error_patterns: List[str] = Field(description="Specific, repeated error patterns observed in the data.")
    flawed_mental_model: str = Field(description="The incorrect mental model or flawed logic the students are using.")
    root_cause: str = Field(description="The root cause of this confusion based on the lesson context.")
    missing_skills: List[str] = Field(description="The specific skills that need to be retaught.")
    intervention_hint: str = Field(description="A targeted intervention hint for the remediation AI.")

class QuizItem(BaseModel):
    question_text: str = Field(
        description="The clear, concise question stem. Uses age-appropriate language, avoids double negatives, and contains no absolute terms like 'always' or 'never'."
    )
    options: Dict[str, str] = Field(
        description="A dictionary of exactly 4 choices mapped to keys 'A', 'B', 'C', and 'D'. Choices must be structurally similar and uniform in length."
    )
    correct_answer: str = Field(
        description="The single, unquestionably correct answer key (e.g., 'A', 'B', 'C', or 'D')."
    )
    targeted_distractor_key: str = Field(
        description="The key ('A', 'B', 'C', or 'D') of the incorrect option that explicitly mimics the student's flawed mental model from the core_diagnosis."
    )
    cognitive_level: str = Field(
        description="The cognitive level tested based on Bloom's Taxonomy (e.g., 'Understanding' or 'Applying')."
    )

class QuizDraftResponse(BaseModel):
    quiz_items: List[QuizItem] = Field(description="A collection of targeted remediation quiz items.")