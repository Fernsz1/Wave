"""REST endpoints (request/response). Live push/pull rides MQTT (see mqtt.py)."""
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from . import codec, ingest, mqtt
from .auth import ApiToken
from .derive import assemble_progress, compute_rankings
from .models import CatalogDocument, RemediationMaterial, Student, Teacher


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login(request):
    data = request.data
    role = data.get("role")
    if role == "student":
        student = Student.objects.filter(lrn=data.get("lrn", "")).first()
        if not student:
            return Response({"error": "LRN not enrolled."}, status=status.HTTP_404_NOT_FOUND)
        if student.pin != data.get("pin", ""):
            return Response({"error": "Incorrect PIN."}, status=status.HTTP_401_UNAUTHORIZED)
        token = ApiToken.issue("student", student.lrn)
        return Response(
            {
                "token": token.key,
                "role": "student",
                "user": {
                    "lrn": student.lrn,
                    "name": student.name,
                    "gradeLevel": student.grade_level,
                    "section": student.section,
                },
            }
        )
    if role == "teacher":
        tid = data.get("teacherId", "").strip()
        name = data.get("name", "").strip()
        if not tid or not name:
            return Response({"error": "Teacher ID and Name required."}, status=status.HTTP_400_BAD_REQUEST)
        teacher = Teacher.objects.filter(teacher_id=tid).first()
        if not teacher:
            return Response({"error": "Teacher ID not recognized."}, status=status.HTTP_404_NOT_FOUND)
        if teacher.name.strip().lower() != name.lower():
            return Response({"error": "Incorrect name for this Teacher ID."}, status=status.HTTP_401_UNAUTHORIZED)
        token = ApiToken.issue("teacher", teacher.teacher_id)
        return Response(
            {
                "token": token.key,
                "role": "teacher",
                "user": {"teacherId": teacher.teacher_id, "name": teacher.name, "department": teacher.department},
            }
        )
    return Response({"error": "Unknown role."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def roster(request):
    """Student and teacher lists for login validation."""
    students = [
        {"lrn": s.lrn, "name": s.name, "gradeLevel": s.grade_level, "section": s.section, "pin": s.pin}
        for s in Student.objects.all()
    ]
    teachers = [
        {"teacherId": t.teacher_id, "name": t.name, "department": t.department}
        for t in Teacher.objects.all()
    ]
    return Response({"students": students, "teachers": teachers})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def all_progress(request):
    """Every student's progress (teacher bootstrap), each as a tokenized StudentProgress array."""
    records = [codec.encode("StudentProgress", assemble_progress(s)) for s in Student.objects.all()]
    return Response({"type": "StudentProgress", "records": records})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def catalog(request):
    subject = request.query_params.get("subject", "science")
    doc = CatalogDocument.objects.filter(subject=subject).first()
    lessons = doc.data if doc else []
    tokens = codec.encode("LessonCatalog", {"subject": subject, "lessons": lessons})
    return Response({"type": "LessonCatalog", "tokens": tokens})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def progress(request, lrn):
    student = Student.objects.filter(lrn=lrn).first()
    if not student:
        return Response({"error": "not found"}, status=status.HTTP_404_NOT_FOUND)
    tokens = codec.encode("StudentProgress", assemble_progress(student))
    return Response({"type": "StudentProgress", "tokens": tokens})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def rankings(request):
    section = request.query_params.get("section", "")
    subject = request.query_params.get("subject", "science")
    tokens = codec.encode("Rankings", compute_rankings(section, subject))
    return Response({"type": "Rankings", "tokens": tokens})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def remediation(request):
    section = request.query_params.get("section", "")
    mats = RemediationMaterial.objects.filter(is_published=True)
    if section:
        mats = mats.filter(target_section=section)
    out = []
    for m in mats:
        obj = {
            "id": m.material_id,
            "originalTopicId": m.original_topic_id,
            "title": m.title,
            "content": m.content,
            "teacherNotes": m.teacher_notes,
            "createdQuiz": m.created_quiz,
            "createdSummative": m.created_summative,
            "publishDate": m.publish_date,
            "targetSection": m.target_section,
            "chunks": [],
            "isPublished": m.is_published,
        }
        out.append(codec.encode("TeacherRemediationMaterial", obj))
    return Response({"type": "TeacherRemediationMaterial", "items": out})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def sync_push(request):
    """REST fallback for 'up' writes. Body: {"envelopes": [<envelope token array>, ...]}."""
    acks = []
    for env_tokens in request.data.get("envelopes", []):
        env = codec.decode_envelope(env_tokens)
        payload = codec.decode(env["type"], env["payload"])
        downstream = ingest.handle(
            env["type"], payload, subject=env.get("subject", ""), section=env.get("section", "")
        )
        mqtt.publish_downstream(downstream)
        acks.append(env.get("msgId"))
    return Response({"acks": acks})
