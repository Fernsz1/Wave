"""
Python mirrors of the canonical wire schemas defined in
`wave/src/schemas/index.ts` and `wave/docs/schemas/*.schema.json`.

These exist so the agent-to-wire adapter has a typed target. Field aliases
use camelCase so `.model_dump(by_alias=True)` round-trips cleanly through
`codec.encode("TeacherRemediationMaterial", ...)`.

Diagnosis and evaluator outputs are deliberately NOT mirrored here — they
are agent-internal and must never reach MQTT/LoRa.
"""
from typing import List
from pydantic import BaseModel, ConfigDict, Field


class WireQuizQuestion(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    question: str
    options: List[str]
    correct_answer_index: int = Field(alias="correctAnswerIndex")
    explanation: str


class WireChunk(BaseModel):
    index: int
    total: int
    data: str


class WireTeacherRemediationMaterial(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    original_topic_id: str = Field(alias="originalTopicId")
    title: str
    content: str
    teacher_notes: str = Field(alias="teacherNotes")
    created_quiz: List[WireQuizQuestion] = Field(alias="createdQuiz")
    publish_date: str = Field(alias="publishDate")
    target_section: str = Field(alias="targetSection")
    chunks: List[WireChunk] = Field(default_factory=list)
    is_published: bool = Field(alias="isPublished")
