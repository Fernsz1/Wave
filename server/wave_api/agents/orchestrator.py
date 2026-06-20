"""
Orchestrates the lesson-generation and quiz-generation LangGraph agents and
produces a validated WireTeacherRemediationMaterial.

Boundaries:
- Agents own pedagogy (diagnosis, drafting, evaluation).
- Orchestrator owns sequencing + assembling agent outputs into the wire shape.
- Route handlers own request parsing, session ids, publish date, and DB writes.
- Transport (mqtt.py / codec.py) owns chunk fragmentation.
"""
from datetime import date
from typing import Any, Dict, List, Optional

from .adapters import (
    extract_analytics_sidecar,
    remediation_to_wire,
)
from .wire_models import WireTeacherRemediationMaterial


def _lesson_workflow_app():
    # Lazy import: the agent graphs pull in langchain_google_genai which is a
    # heavy optional dependency. Keep `from wave_api.agents import orchestrator`
    # importable at Django startup even when those deps are missing.
    from .lesson_generation_agent.nodes import workflow_app
    return workflow_app


def _quiz_graph():
    from .quiz_generation_agent.nodes import graph
    return graph


def _lesson_config(session_id: str) -> Dict[str, Any]:
    return {"configurable": {"thread_id": f"lesson-{session_id}"}}


def _quiz_config(session_id: str) -> Dict[str, Any]:
    return {"configurable": {"thread_id": f"quiz-{session_id}"}}


def start_remediation_session(
    *,
    session_id: str,
    subject: str,
    grade_level: int,
    original_topic_id: str,
    topic: str,
    lesson_context: str,
    failed_items: List[Dict[str, Any]],
    target_section: str,
) -> Dict[str, Any]:
    """Run the lesson graph until the TeacherReview interrupt.

    Returns the current draft and evaluation remarks. The quiz graph is not
    invoked yet — quiz generation runs after the teacher approves the lesson
    in `finalize_and_publish` so revisions don't trigger redundant quiz runs.
    """
    initial_state = {
        "subject": subject,
        "grade_level": grade_level,
        "original_topic_id": original_topic_id,
        "topic": topic,
        "lesson_context": lesson_context,
        "failed_items": failed_items,
        "target_section": target_section,
        "publish_date": "",
        "teacher_feedback": "",
        "revision_count": 0,
        "teacher_revisions": 0,
        "is_approved": False,
    }
    current_state = _lesson_workflow_app().invoke(initial_state, _lesson_config(session_id))
    return {
        "draft_lesson": current_state.get("draft_lesson"),
        "revision_remarks": current_state.get("revision_remarks"),
        "core_diagnosis": current_state.get("core_diagnosis"),
    }


def _require_session(session_id: str) -> Dict[str, Any]:
    config = _lesson_config(session_id)
    snap = _lesson_workflow_app().get_state(config)
    values = getattr(snap, "values", None) if snap is not None else None
    if not values:
        raise KeyError(session_id)
    return config


def apply_teacher_feedback(
    *,
    session_id: str,
    feedback: str,
) -> Dict[str, Any]:
    """Resume the lesson graph after the teacher hits a revision button."""
    config = _require_session(session_id)
    _lesson_workflow_app().update_state(config, {"teacher_feedback": feedback})
    new_state = _lesson_workflow_app().invoke(None, config)
    return {
        "draft_lesson": new_state.get("draft_lesson"),
        "revision_remarks": new_state.get("revision_remarks"),
        "core_diagnosis": new_state.get("core_diagnosis"),
    }


def finalize_and_publish(
    *,
    session_id: str,
    material_id: str,
    publish_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Approved by teacher: run the quiz graph, adapt to wire, return payload.

    Output dict:
        wire:      WireTeacherRemediationMaterial ready for codec.encode
        analytics: sidecar dict (cognitive_level + targeted_distractor_key per item)
    """
    config = _require_session(session_id)
    _lesson_workflow_app().update_state(config, {"teacher_feedback": "PASS"})
    final_lesson_state = _lesson_workflow_app().invoke(None, config)

    approved_draft = (
        final_lesson_state.get("final_lesson")
        or final_lesson_state.get("draft_lesson")
        or {}
    )

    quiz_initial_state = {
        "subject": final_lesson_state.get("subject", ""),
        "grade_level": final_lesson_state.get("grade_level", 0),
        "original_topic_id": final_lesson_state.get("original_topic_id", ""),
        "topic": final_lesson_state.get("topic", ""),
        "lesson_context": final_lesson_state.get("lesson_context", ""),
        "failed_items": final_lesson_state.get("failed_items", []),
        "core_diagnosis": final_lesson_state.get("core_diagnosis", {}),
        "has_lesson_content": True,
        "human_feedback": "approve",
    }
    quiz_state = _quiz_graph().invoke(quiz_initial_state, _quiz_config(session_id))
    # `quiz_draft` is a QuizDraftResponse dump ({"quiz_items": [...]}), not the
    # list itself — unwrap to the items the adapter expects.
    quiz_draft = quiz_state.get("quiz_draft") or {}
    quiz_items: List[Dict[str, Any]] = (
        quiz_draft.get("quiz_items", []) if isinstance(quiz_draft, dict) else (quiz_draft or [])
    )

    original_topic_id = final_lesson_state.get("original_topic_id", "")
    target_section = final_lesson_state.get("target_section", "")
    resolved_publish_date = publish_date or date.today().isoformat()

    wire: WireTeacherRemediationMaterial = remediation_to_wire(
        approved_draft,
        quiz_items,
        material_id=material_id,
        original_topic_id=original_topic_id,
        target_section=target_section,
        publish_date=resolved_publish_date,
        is_published=True,
        chunks=[],
        subject=final_lesson_state.get("subject", ""),
    )
    analytics = extract_analytics_sidecar(
        quiz_items,
        topic_code="".join(c for c in original_topic_id if c.isalnum()).upper(),
    )

    return {
        "wire": wire,
        "analytics": analytics,
        "subject": final_lesson_state.get("subject", ""),
    }
