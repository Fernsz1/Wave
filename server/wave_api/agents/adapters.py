"""
Adapters between LangGraph agent outputs and the canonical wire schemas.

The agents emit pedagogically-rich shapes (letter-keyed options, Bloom's
cognitive levels, targeted-distractor keys). The wire model is product-shaped
(ordered options, integer index). This module is the single conversion point.

Pedagogical metadata that has no wire field (cognitive_level,
targeted_distractor_key) is extracted into a sidecar dict for server-only
analytics storage. It never crosses the LoRa boundary.
"""
from typing import Any, Dict, List

from .wire_models import (
    WireChunk,
    WireQuizQuestion,
    WireTeacherRemediationMaterial,
)

_OPTION_KEYS = ("A", "B", "C", "D")


def _normalize_quiz_item(item: Any) -> Dict[str, Any]:
    """Accepts a Pydantic QuizItem or a plain dict and returns dict-of-fields."""
    if hasattr(item, "model_dump"):
        return item.model_dump()
    return dict(item)


def quiz_item_to_wire(
    item: Any,
    *,
    topic_code: str,
    sequence: int,
) -> WireQuizQuestion:
    """Convert one agent QuizItem -> WireQuizQuestion.

    - Orders the A-D option dict into a list with stable A,B,C,D order.
    - Translates the letter `correct_answer` into `correctAnswerIndex`.
    - Synthesizes `id` deterministically from `quiz_generation_templates.json`
      pattern: `QREM-{topicCode}{sequence}`.
    - Drops `cognitive_level` and `targeted_distractor_key` (sidecar fields).
    """
    raw = _normalize_quiz_item(item)
    options_dict: Dict[str, str] = raw.get("options", {}) or {}
    options_list: List[str] = [options_dict[k] for k in _OPTION_KEYS if k in options_dict]

    correct_letter = (raw.get("correct_answer") or "").strip().upper()
    if correct_letter not in _OPTION_KEYS or correct_letter not in options_dict:
        raise ValueError(
            f"QuizItem has invalid correct_answer={raw.get('correct_answer')!r}; "
            f"options keys={list(options_dict.keys())}"
        )
    correct_index = _OPTION_KEYS.index(correct_letter)

    item_id = f"QREM-{topic_code}{sequence:02d}"

    return WireQuizQuestion(
        id=item_id,
        question=raw.get("question_text", ""),
        options=options_list,
        correct_answer_index=correct_index,
        explanation=raw.get("explanation", ""),
    )


def quiz_items_to_wire(items: List[Any], *, topic_code: str) -> List[WireQuizQuestion]:
    return [
        quiz_item_to_wire(item, topic_code=topic_code, sequence=i + 1)
        for i, item in enumerate(items)
    ]


def extract_analytics_sidecar(items: List[Any], *, topic_code: str) -> Dict[str, Any]:
    """Collect cognitive_level + targeted_distractor_key per generated item.

    Stored server-side on RemediationMaterial.analytics. Never sent to devices.
    """
    sidecar: List[Dict[str, Any]] = []
    for i, item in enumerate(items):
        raw = _normalize_quiz_item(item)
        sidecar.append({
            "id": f"QREM-{topic_code}{i + 1:02d}",
            "cognitive_level": raw.get("cognitive_level", ""),
            "targeted_distractor_key": raw.get("targeted_distractor_key", ""),
        })
    return {"quiz_items": sidecar}


def _topic_code(original_topic_id: str) -> str:
    """Compact alphanumeric token derived from the source topic id.

    `L1-T2` -> `L1T2`. Keeps the QREM ids short for LoRa frames.
    """
    return "".join(c for c in original_topic_id if c.isalnum()).upper()


def remediation_to_wire(
    draft: Any,
    quiz_items: List[Any],
    *,
    material_id: str,
    original_topic_id: str,
    target_section: str,
    publish_date: str,
    is_published: bool = False,
    chunks: List[WireChunk] | None = None,
    subject: str = "",
) -> WireTeacherRemediationMaterial:
    """Assemble a complete WireTeacherRemediationMaterial from agent outputs.

    `chunks` is left empty by default — fragmentation is the transport
    layer's job, not the agent's or the orchestrator's. `created_summative`
    is left empty too: the agent pipeline only generates the topic-level
    remedial quiz, never a lesson-level summative.
    """
    draft_dict = draft.model_dump() if hasattr(draft, "model_dump") else dict(draft)
    topic_code = _topic_code(original_topic_id)
    wire_quiz = quiz_items_to_wire(quiz_items, topic_code=topic_code)

    return WireTeacherRemediationMaterial(
        id=material_id,
        original_topic_id=original_topic_id,
        title=draft_dict.get("title", ""),
        content=draft_dict.get("content", ""),
        teacher_notes=draft_dict.get("teacher_notes", ""),
        created_quiz=wire_quiz,
        publish_date=publish_date,
        target_section=target_section,
        chunks=chunks or [],
        is_published=is_published,
        subject=subject,
    )
