"""
Session-based, human-in-the-loop lesson generation (LangGraph orchestrator).

Not yet wired to the frontend: RemediationWizard.tsx and TeacherHome.tsx both
call the single-shot /api/remediation/generate (see ai.generate_remediation /
views.generate_remediation), which remains the canonical generation path for
now. These endpoints stay available for the future multi-turn teacher-review
flow (start -> draft -> feedback loop -> PASS -> publish).
"""
import uuid
from datetime import date

from rest_framework import serializers, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from wave_api.models import RemediationMaterial

# NOTE: `wave_api.agents.orchestrator` pulls in the heavy AI stack (pydantic,
# langgraph, langchain). It is imported lazily inside each view so a missing AI
# dependency cannot break URLconf import (and therefore the whole REST API).


VALID_FEEDBACK = ["PASS", "simplify", "practical", "change", "micro"]


class InitialLessonSerializer(serializers.Serializer):
    subject = serializers.CharField()
    grade_level = serializers.IntegerField()
    original_topic_id = serializers.CharField()
    topic = serializers.CharField(required=False, allow_blank=True, default="")
    lesson_context = serializers.CharField(required=False, allow_blank=True, default="")
    target_section = serializers.CharField(required=False, allow_blank=True, default="")
    failed_items = serializers.ListField(child=serializers.DictField(), min_length=1)


class TeacherFeedbackSerializer(serializers.Serializer):
    session_id = serializers.CharField()
    feedback = serializers.ChoiceField(choices=VALID_FEEDBACK)
    material_id = serializers.CharField(required=False, allow_blank=True, default="")


@api_view(['POST'])
def start_lesson_generation(request):
    """Run the lesson graph up to the TeacherReview interrupt and return the draft."""
    serializer = InitialLessonSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    session_id = str(uuid.uuid4())

    try:
        from wave_api.agents import orchestrator  # lazy: heavy AI deps
    except ImportError:
        return Response(
            {"detail": "AI lesson generation is not available (AI dependencies not installed)."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    result = orchestrator.start_remediation_session(
        session_id=session_id,
        subject=data['subject'],
        grade_level=data['grade_level'],
        original_topic_id=data['original_topic_id'],
        topic=data.get('topic', ''),
        lesson_context=data.get('lesson_context', ''),
        failed_items=data['failed_items'],
        target_section=data.get('target_section', ''),
    )

    return Response({
        "session_id": session_id,
        "draft_lesson": result.get("draft_lesson"),
        "ai_evaluation_remarks": result.get("revision_remarks"),
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def submit_teacher_feedback(request):
    """Apply the teacher's feedback. On PASS, finalize and persist a wire-shaped material."""
    serializer = TeacherFeedbackSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    session_id = data['session_id']
    feedback = data['feedback']

    try:
        from wave_api.agents import orchestrator  # lazy: heavy AI deps
    except ImportError:
        return Response(
            {"detail": "AI lesson generation is not available (AI dependencies not installed)."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if feedback == "PASS":
        material_id = data.get("material_id") or f"REM-{uuid.uuid4().hex[:10].upper()}"
        try:
            finalized = orchestrator.finalize_and_publish(
                session_id=session_id,
                material_id=material_id,
                publish_date=date.today().isoformat(),
            )
        except KeyError:
            return Response(
                {"detail": f"Session {session_id} not found or already completed."},
                status=status.HTTP_404_NOT_FOUND,
            )
        wire = finalized["wire"]
        wire_dict = wire.model_dump(by_alias=True)

        RemediationMaterial.objects.update_or_create(
            material_id=wire.id,
            defaults={
                "subject": finalized.get("subject", "science"),
                "original_topic_id": wire.original_topic_id,
                "title": wire.title,
                "content": wire.content,
                "teacher_notes": wire.teacher_notes,
                "learning_gap": wire.learning_gap,
                # Remedial = summative only; the agent's generated test is the summative.
                "created_summative": [q.model_dump(by_alias=True) for q in wire.created_quiz],
                "publish_date": wire.publish_date,
                "target_section": wire.target_section,
                "is_published": wire.is_published,
                "analytics": finalized.get("analytics", {}),
            },
        )

        return Response({
            "status": "completed",
            "type": "TeacherRemediationMaterial",
            "material": wire_dict,
        }, status=status.HTTP_200_OK)

    try:
        result = orchestrator.apply_teacher_feedback(
            session_id=session_id,
            feedback=feedback,
        )
    except KeyError:
        return Response(
            {"detail": f"Session {session_id} not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response({
        "status": "needs_review",
        "message": f"Applied {feedback} feedback. Review the new draft.",
        "draft_lesson": result.get("draft_lesson"),
        "ai_evaluation_remarks": result.get("revision_remarks"),
    }, status=status.HTTP_200_OK)


# =============================================
# Endpoint: Lesson Generation Only (no quiz)
# =============================================
@api_view(['POST'])
def start_lesson_only(request):
    """
    Run ONLY the lesson generation agent (diagnose -> draft -> evaluate -> finalize)
    and return the outputs without invoking the quiz agent.
    """
    serializer = InitialLessonSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    session_id = str(uuid.uuid4())

    try:
        from wave_api.agents import orchestrator  # lazy: heavy AI deps
    except ImportError:
        return Response(
            {"detail": "AI lesson generation is not available (AI dependencies not installed)."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # 1. Run the lesson graph up to the TeacherReview interrupt
    result = orchestrator.start_remediation_session(
        session_id=session_id,
        subject=data['subject'],
        grade_level=data['grade_level'],
        original_topic_id=data['original_topic_id'],
        topic=data.get('topic', ''),
        lesson_context=data.get('lesson_context', ''),
        failed_items=data['failed_items'],
        target_section=data.get('target_section', ''),
    )

    # 2. Auto-approve the lesson (send PASS feedback to finalize)
    try:
        final_state = orchestrator.auto_approve_lesson(session_id=session_id)
    except KeyError:
        return Response(
            {"detail": f"Session {session_id} not found or already completed."},
            status=status.HTTP_404_NOT_FOUND,
        )

    approved_lesson = (
        final_state.get("final_lesson")
        or final_state.get("draft_lesson")
        or {}
    )

    return Response({
        "session_id": session_id,
        "status": "completed",
        "core_diagnosis": final_state.get("core_diagnosis"),
        "draft_lesson": approved_lesson,
        "ai_evaluation_remarks": result.get("revision_remarks"),
    }, status=status.HTTP_200_OK)


# =============================================
# Endpoint: Lesson + Quiz Generation (chained)
# =============================================
@api_view(['POST'])
def start_lesson_and_quiz(request):
    """
    Run the lesson generation agent first, then feed its approved output
    into the quiz generation agent. Returns both the finalized lesson
    and the generated quiz in one response.
    """
    serializer = InitialLessonSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    session_id = str(uuid.uuid4())

    try:
        from wave_api.agents import orchestrator  # lazy: heavy AI deps
    except ImportError:
        return Response(
            {"detail": "AI lesson generation is not available (AI dependencies not installed)."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # 1. Run the lesson graph up to the TeacherReview interrupt
    result = orchestrator.start_remediation_session(
        session_id=session_id,
        subject=data['subject'],
        grade_level=data['grade_level'],
        original_topic_id=data['original_topic_id'],
        topic=data.get('topic', ''),
        lesson_context=data.get('lesson_context', ''),
        failed_items=data['failed_items'],
        target_section=data.get('target_section', ''),
    )

    # 2. Auto-approve the lesson so it finalizes
    try:
        finalized = orchestrator.finalize_and_publish(
            session_id=session_id,
            material_id=f"REM-{uuid.uuid4().hex[:10].upper()}",
            publish_date=date.today().isoformat(),
        )
    except KeyError:
        return Response(
            {"detail": f"Session {session_id} could not be finalized."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # 3. Extract wire model and convert to dict
    wire = finalized["wire"]
    wire_dict = wire.model_dump(by_alias=True)

    # 4. Persist to RemediationMaterial
    RemediationMaterial.objects.update_or_create(
        material_id=wire.id,
        defaults={
            "subject": finalized.get("subject", "science"),
            "original_topic_id": wire.original_topic_id,
            "title": wire.title,
            "content": wire.content,
            "teacher_notes": wire.teacher_notes,
            "learning_gap": wire.learning_gap,
            # Remedial = summative only; the agent's generated test is the summative.
            "created_summative": [q.model_dump(by_alias=True) for q in wire.created_quiz],
            "publish_date": wire.publish_date,
            "target_section": wire.target_section,
            "is_published": wire.is_published,
            "analytics": finalized.get("analytics", {}),
        },
    )

    return Response({
        "session_id": session_id,
        "status": "completed",
        "core_diagnosis": result.get("core_diagnosis"),
        "draft_lesson": result.get("draft_lesson"),
        "ai_evaluation_remarks": result.get("revision_remarks"),
        "material": wire_dict,
    }, status=status.HTTP_200_OK)
