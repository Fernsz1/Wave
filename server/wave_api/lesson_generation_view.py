import uuid
from datetime import date

from rest_framework import serializers, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from wave_api.agents import orchestrator
from wave_api.models import RemediationMaterial


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
                "created_quiz": [q.model_dump(by_alias=True) for q in wire.created_quiz],
                "created_summative": [q.model_dump(by_alias=True) for q in (wire.created_summative or [])],
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
