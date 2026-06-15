from pydantic import BaseModel, Field

class RemediationScores(BaseModel):
    structural_compliance: int = Field(
        description="Score 1-5. Strictly follows the required 8-part Markdown structure and maintains extreme conciseness (approximately 250 words total).", 
        ge=1, le=5
    )
    diagnostic_alignment: int = Field(
        description="Score 1-5. Directly targets the 'misconception' and 'root_cause' from the diagnosis without reteaching the entire original lesson.", 
        ge=1, le=5
    )
    instructional_clarity: int = Field(
        description="Score 1-5. The 'Concept Review', 'The Mistake', and 'Correct Approach' sections are simple, actionable, and logically rebuild the student's understanding.", 
        ge=1, le=5
    )
    application_quality: int = Field(
        description="Score 1-5. The 'Guided Example', 'Practice', and 'Mastery Check' are highly relevant, extremely brief, and directly test the corrected concept.", 
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