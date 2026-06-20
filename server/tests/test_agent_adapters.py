"""Unit tests for the agent->wire adapter layer."""
import pytest

from wave_api import codec
from wave_api.agents.adapters import (
    extract_analytics_sidecar,
    quiz_item_to_wire,
    quiz_items_to_wire,
    remediation_to_wire,
)
from wave_api.agents.lesson_generation_agent.output_schema import RemediationDraftResponse
from wave_api.agents.quiz_generation_agent.output_schema import QuizItem
from wave_api.agents.wire_models import WireTeacherRemediationMaterial


def _sample_quiz_item(correct="B", explanation="Because X."):
    return QuizItem(
        question_text="Which option correctly identifies the heart's function?",
        options={"A": "Digests food", "B": "Pumps blood", "C": "Filters air", "D": "Stores memory"},
        correct_answer=correct,
        targeted_distractor_key="A",
        cognitive_level="Understanding",
        explanation=explanation,
    )


def test_quiz_item_to_wire_basic_conversion():
    item = _sample_quiz_item()
    wire = quiz_item_to_wire(item, topic_code="L1T2", sequence=1)
    assert wire.id == "QREM-L1T201"
    assert wire.question == "Which option correctly identifies the heart's function?"
    assert wire.options == ["Digests food", "Pumps blood", "Filters air", "Stores memory"]
    assert wire.correct_answer_index == 1
    assert wire.explanation == "Because X."


def test_quiz_item_to_wire_preserves_option_order():
    item = _sample_quiz_item(correct="D")
    wire = quiz_item_to_wire(item, topic_code="X1", sequence=7)
    assert wire.correct_answer_index == 3
    assert wire.id == "QREM-X107"


def test_quiz_item_to_wire_rejects_unknown_letter():
    item = _sample_quiz_item(correct="E")
    with pytest.raises(ValueError):
        quiz_item_to_wire(item, topic_code="L1T2", sequence=1)


def test_wire_dump_uses_camel_case_aliases():
    item = _sample_quiz_item()
    wire = quiz_item_to_wire(item, topic_code="L1T2", sequence=1)
    payload = wire.model_dump(by_alias=True)
    assert "correctAnswerIndex" in payload
    assert "correct_answer_index" not in payload
    # Internal-only pedagogical metadata MUST NOT leak to the wire payload.
    assert "cognitive_level" not in payload
    assert "targeted_distractor_key" not in payload
    assert "targetedDistractorKey" not in payload
    assert "cognitiveLevel" not in payload


def test_quiz_items_to_wire_sequences_ids():
    items = [_sample_quiz_item(), _sample_quiz_item(correct="A"), _sample_quiz_item(correct="C")]
    wires = quiz_items_to_wire(items, topic_code="L1T2")
    assert [w.id for w in wires] == ["QREM-L1T201", "QREM-L1T202", "QREM-L1T203"]
    assert [w.correct_answer_index for w in wires] == [1, 0, 2]


def test_extract_analytics_sidecar_carries_internal_fields():
    items = [_sample_quiz_item(), _sample_quiz_item(correct="C")]
    sidecar = extract_analytics_sidecar(items, topic_code="L1T2")
    assert sidecar["quiz_items"] == [
        {"id": "QREM-L1T201", "cognitive_level": "Understanding", "targeted_distractor_key": "A"},
        {"id": "QREM-L1T202", "cognitive_level": "Understanding", "targeted_distractor_key": "A"},
    ]


def test_remediation_to_wire_full_payload_matches_zod_shape():
    draft = RemediationDraftResponse(
        title="Heart vs. Lungs",
        content="### 1. Focus Area\nThe heart pumps blood.\n\n### 8. Key Takeaways\n- Heart pumps.",
        teacher_notes="Students confuse cardiac and respiratory functions.",
    )
    items = [_sample_quiz_item(), _sample_quiz_item(correct="A")]
    wire = remediation_to_wire(
        draft,
        items,
        material_id="REM-ABCDEF0123",
        original_topic_id="L1-T2",
        target_section="Grade 6 - Section Newton",
        publish_date="2026-06-18",
        is_published=True,
    )
    payload = wire.model_dump(by_alias=True)
    expected_keys = {
        "id",
        "originalTopicId",
        "title",
        "content",
        "teacherNotes",
        "createdQuiz",
        "createdSummative",
        "publishDate",
        "targetSection",
        "chunks",
        "isPublished",
        "subject",
    }
    assert set(payload.keys()) == expected_keys
    assert payload["originalTopicId"] == "L1-T2"
    assert payload["targetSection"] == "Grade 6 - Section Newton"
    assert payload["publishDate"] == "2026-06-18"
    assert payload["isPublished"] is True
    assert payload["chunks"] == []
    # No summative agent and no subject passed -> these stay absent on the wire.
    assert payload["createdSummative"] is None
    assert payload["subject"] is None
    # createdQuiz items are camelCase too
    assert payload["createdQuiz"][0]["correctAnswerIndex"] == 1
    assert payload["createdQuiz"][1]["correctAnswerIndex"] == 0
    # The QREM id uses the alphanumeric topic code derived from L1-T2 -> L1T2
    assert payload["createdQuiz"][0]["id"] == "QREM-L1T201"


def test_missing_option_key_for_correct_letter_raises():
    item = QuizItem(
        question_text="Q?",
        options={"A": "x", "B": "y", "C": "z"},  # only 3 keys
        correct_answer="D",                       # references missing key
        targeted_distractor_key="A",
        cognitive_level="Understanding",
        explanation="...",
    )
    with pytest.raises(ValueError, match="invalid correct_answer"):
        quiz_item_to_wire(item, topic_code="T1", sequence=1)


def test_short_options_dict_only_emits_present_keys():
    # If the agent legitimately produces fewer than 4 options and the correct
    # answer is one of the present keys, the adapter passes them through in
    # stable A,B,C,D order, omitting missing keys.
    item = QuizItem(
        question_text="Q?",
        options={"A": "x", "B": "y", "C": "z"},
        correct_answer="A",
        targeted_distractor_key="B",
        cognitive_level="Understanding",
        explanation="...",
    )
    wire = quiz_item_to_wire(item, topic_code="T1", sequence=1)
    assert wire.options == ["x", "y", "z"]
    assert wire.correct_answer_index == 0


def test_topic_code_strips_to_empty_still_produces_well_formed_id():
    from wave_api.agents.adapters import _topic_code

    item = _sample_quiz_item()
    # original_topic_id with no alphanumerics -> topic_code "" -> id "QREM-01"
    assert _topic_code("—/—") == ""
    wire = quiz_item_to_wire(item, topic_code=_topic_code("—/—"), sequence=1)
    assert wire.id == "QREM-01"


def test_sidecar_keys_not_in_full_wire_dump():
    items = [_sample_quiz_item(), _sample_quiz_item(correct="A")]
    draft = RemediationDraftResponse(title="t", content="c", teacher_notes="n")
    wire = remediation_to_wire(
        draft,
        items,
        material_id="REM-1",
        original_topic_id="L1-T2",
        target_section="Sec",
        publish_date="2026-06-18",
    )
    serialized = wire.model_dump_json(by_alias=True)
    for forbidden in ("targeted_distractor_key", "targetedDistractorKey",
                      "cognitive_level", "cognitiveLevel"):
        assert forbidden not in serialized, f"{forbidden} leaked to wire"


def test_remediation_to_wire_accepts_dict_draft():
    items = [_sample_quiz_item()]
    wire = remediation_to_wire(
        {"title": "T", "content": "C", "teacher_notes": "N"},
        items,
        material_id="REM-XYZ",
        original_topic_id="L9-T9",
        target_section="Section A",
        publish_date="2026-06-18",
    )
    assert isinstance(wire, WireTeacherRemediationMaterial)
    assert wire.title == "T"
    assert wire.teacher_notes == "N"
    assert wire.is_published is False


def test_remediation_to_wire_carries_subject_and_summative():
    """subject + summative_items survive the adapter and a codec round-trip,
    re-validating against the generated wire model (AI I/O <-> schema)."""
    quiz = [_sample_quiz_item()]
    summative = [_sample_quiz_item(correct="C", explanation="Summative rationale.")]
    wire = remediation_to_wire(
        {"title": "Photosynthesis", "content": "Body", "teacher_notes": "Notes"},
        quiz,
        material_id="REM-SUBJ1",
        original_topic_id="L1-T2",
        target_section="Grade 7 - Section Rizal",
        publish_date="2026-06-18",
        is_published=True,
        subject="science",
        summative_items=summative,
    )
    assert wire.subject == "science"
    assert wire.created_summative and len(wire.created_summative) == 1

    # Encode through the shared codec and re-validate the decoded object.
    payload = wire.model_dump(by_alias=True)
    decoded = codec.decode("TeacherRemediationMaterial", codec.encode("TeacherRemediationMaterial", payload))
    revalidated = WireTeacherRemediationMaterial(**decoded)
    assert revalidated.subject == "science"
    assert revalidated.created_summative[0].id == "QREM-L1T201"
    assert revalidated.created_quiz[0].correct_answer_index == 1
