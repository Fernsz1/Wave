import uuid
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework import serializers
from server.wave_api.agents.lesson_generation_agent.nodes import workflow_app

# --- Data Models (Serializers instead of Pydantic) ---
class InitialLessonSerializer(serializers.Serializer):
    subject = serializers.CharField()
    grade_level = serializers.IntegerField() # Changed to IntegerField to match AgentState
    original_topic_id = serializers.CharField()
    # Changed to DictField to match List[Dict[str, Any]] in AgentState
    failed_items = serializers.ListField(child=serializers.DictField()) 

class TeacherFeedbackSerializer(serializers.Serializer):
    session_id = serializers.CharField()
    feedback = serializers.CharField()

# --- 1. Endpoint to Start the Process ---
@api_view(['POST'])
def start_lesson_generation(request):
    """
    Starts the AI drafting process. It will run until it hits the TeacherReview node and pause.
    """
    # 1. Validate incoming data
    serializer = InitialLessonSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    data = serializer.validated_data

    # 2. Generate a unique session ID for this specific teacher's lesson
    session_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": session_id}}
    
    # 3. Prepare the initial state
    initial_state = {
        "subject": data['subject'],
        "grade_level": data['grade_level'],
        "original_topic_id": data['original_topic_id'],
        "topic": "",                   
        "lesson_context": "",
        "failed_items": data['failed_items'],
        "teacher_feedback": "",
        "revision_count": 0, 
        "teacher_revisions": 0
    }
    
    # 4. Invoke the graph. It will process, draft, evaluate, and then PAUSE.
    print(f"Starting session {session_id}...")
    current_state = workflow_app.invoke(initial_state, config)
    
    # 5. Return the drafted lesson and the session_id to the frontend
    return Response({
        "session_id": session_id,
        "draft_lesson": current_state.get("draft_lesson"),
        "ai_evaluation_remarks": current_state.get("revision_remarks")
    }, status=status.HTTP_200_OK)


# --- 2. Endpoint to Submit Feedback and Resume ---
@api_view(['POST'])
def submit_teacher_feedback(request):
    """
    Takes the teacher's feedback from the UI, updates the paused state, and resumes the graph.
    """
    # 1. Validate incoming data
    serializer = TeacherFeedbackSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    session_id = data['session_id']
    feedback = data['feedback']

    config = {"configurable": {"thread_id": session_id}}
    
    # 2. Check if this session actually exists and is paused
    current_state = workflow_app.get_state(config)
    if not current_state:
        return Response(
            {"detail": "Session not found or already completed."}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # 3. Update the state in memory with the teacher's choice
    print(f"Applying feedback '{feedback}' to session {session_id}...")
    workflow_app.update_state(
        config,
        {"teacher_feedback": feedback}
    )
    
    # 4. Wake the graph back up by invoking it with None.
    final_state = workflow_app.invoke(None, config)
    
    # 5. Check what happened after we resumed
    if feedback == "PASS":
        return Response({
            "status": "completed",
            "final_lesson": final_state.get("final_lesson")
        }, status=status.HTTP_200_OK)
    else:
        return Response({
            "status": "needs_review",
            "message": f"Applied {feedback} feedback. Review the new draft.",
            "draft_lesson": final_state.get("draft_lesson"),
            "ai_evaluation_remarks": final_state.get("revision_remarks")
        }, status=status.HTTP_200_OK)