from pydantic import BaseModel, Field 
from typing import List 

class DiagnosisResult(BaseModel):
    topic: str = Field(description="The topic of the lesson.")
    primary_misunderstanding: str = Field(description="The primary misunderstanding driving the majority of errors.")
    common_error_patterns: List[str] = Field(description="Specific, repeated error patterns observed in the data.")
    flawed_mental_model: str = Field(description="The incorrect mental model or flawed logic the students are using.")
    root_cause: str = Field(description="The root cause of this confusion based on the lesson context.")
    missing_skills: List[str] = Field(description="The specific skills that need to be retaught.")
    intervention_hint: str = Field(description="A targeted intervention hint for the remediation AI.")