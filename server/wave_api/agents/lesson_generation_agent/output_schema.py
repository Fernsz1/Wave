from pydantic import BaseModel, Field
from typing import List

class RemediationDraftResponse(BaseModel):
    title: str = Field(description="Short, student-facing title for the remediation handbook.")
    content: str = Field(
        description="The 8-part Markdown remediation handbook (~250 words) addressed to the student."
    )
    teacher_notes: str = Field(
        description="Concise, teacher-facing notes summarizing the misconception targeted and how to support students using this handbook."
    )

class StudentDiagnosis(BaseModel):
    topic: str = Field(description="The topic of the lesson.")
    learning_gap: str = Field(description="The exact concept students failed to understand.")
    misconception: str = Field(description="The incorrect thinking pattern behind their mistakes.")
    error_pattern: str = Field(description="The repeated error patterns across answers.")
    root_cause: str = Field(description="Why this misconception likely formed based on the context.")
    affected_skills: List[str] = Field(description="The specific skills that are missing.")
    intervention_hint: str = Field(description="A short intervention hint for the next AI (NOT a lesson).")

class RemediationScores(BaseModel):
    structural_compliance: int = Field(
        description="Score 1-5. Strictly follows the required structure of a 'concepts' list, where each item contains a 'header_title' and an 'explanation'. Maintains appropriate conciseness.", 
        ge=1, le=5
    )
    diagnostic_alignment: int = Field(
        description="Score 1-5. The chosen concepts and explanations directly target and resolve the 'root_cause' and misconception from the diagnosis without unnecessary fluff.", 
        ge=1, le=5
    )
    instructional_clarity: int = Field(
        description="Score 1-5. The 'header_title' is engaging and clear. The 'explanation' is simple, direct, and logically rebuilds the student's understanding.", 
        ge=1, le=5
    )
    pedagogical_effectiveness: int = Field(
        description="Score 1-5. Explanations include practical examples, heuristics, or 'tricks' that make the concept easy to apply in real-time, rather than just abstract definitions.", 
        ge=1, le=5
    )
    tone_and_suitability: int = Field(
        description="Score 1-5. The language is encouraging, avoids unnecessary jargon, and strictly matches the vocabulary and complexity expected for the target Grade Level.", 
        ge=1, le=5
    )

class RemediationEvaluationResult(BaseModel):
    scores: RemediationScores
    is_approved: bool = Field(
        description="Strictly False if ANY single score is 3 or lower. True ONLY if ALL scores are 4 or 5."
    )
    remarks: str = Field(
        description="If failed, provide exactly 2-3 sentences of direct, actionable feedback identifying which section failed and how the generator must rewrite it. If passed, state 'Remediation material meets all instructional standards.'"
    )

class RemediationConcept(BaseModel):
    header_title: str = Field(
        description="A catchy, clear, and engaging title for the concept (e.g., 'The Doer vs. The Receiver' or 'The Past Tense Trap')."
    )
    explanation: str = Field(
        description="A highly pedagogical, concise explanation. Must include practical examples, heuristics, or 'tricks' to fix the misconception."
    )

class RemediationLesson(BaseModel):
    concepts: List[RemediationConcept] = Field(
        description="A list of targeted concepts designed to remediate the student's specific learning gap."
    )