"""
Canned agent outputs used by integration / e2e tests.

These are the Pydantic objects we expect the real LLM to produce, frozen so
tests can run deterministically without an API key. Importable by test
modules to seed `with_structured_output` mocks.
"""
from wave_api.agents.lesson_generation_agent.output_schema import (
    RemediationDraftResponse,
    RemediationEvaluationResult,
    RemediationScores,
    StudentDiagnosis,
)
from wave_api.agents.quiz_generation_agent.output_schema import (
    CriteriaScores,
    DiagnosisResult,
    QuizDraftResponse,
    QuizEvaluationResult,
    QuizItem,
)


def diagnosis_lesson() -> StudentDiagnosis:
    return StudentDiagnosis(
        topic="Involuntary vs. Voluntary Muscles",
        learning_gap="Students cannot distinguish involuntary from voluntary muscles.",
        misconception="Any muscle they can feel moving is voluntary.",
        error_pattern="They pick limb muscles when asked for involuntary examples.",
        root_cause="Conflating 'aware of movement' with 'choosing the movement'.",
        affected_skills=["classify muscle types", "match example to type"],
        intervention_hint="Contrast heart/intestine with bicep using concrete daily examples.",
    )


def draft_default() -> RemediationDraftResponse:
    return RemediationDraftResponse(
        title="Muscles That Work On Their Own",
        content=(
            "### 1. Focus Area\nFix the idea that any visible muscle is voluntary.\n\n"
            "### 2. Concept Review\nInvoluntary muscles act without conscious thought (heart, gut).\n\n"
            "### 3. The Mistake\nLabeling the bicep involuntary because it 'just moves'.\n\n"
            "### 4. Correct Approach\nAsk: did I decide? Yes -> voluntary. No -> involuntary.\n\n"
            "### 5. Guided Example\nHeart beats while you sleep -> involuntary.\n\n"
            "### 6. Practice\nName one involuntary muscle in your digestive system.\n\n"
            "### 7. Mastery Check\nWhich is voluntary: stomach lining or hand muscles? Answer: hand.\n\n"
            "### 8. Key Takeaways\n- Voluntary = chosen.\n- Involuntary = automatic."
        ),
        teacher_notes="Class confuses 'muscle I can feel' with 'voluntary muscle.'",
    )


def draft_simplified() -> RemediationDraftResponse:
    base = draft_default()
    return base.model_copy(update={
        "title": "Easy Muscles Guide",
        "content": base.content.replace("conscious thought", "thinking about it"),
        "teacher_notes": "Simplified vocabulary per teacher request.",
    })


def evaluation_pass() -> RemediationEvaluationResult:
    return RemediationEvaluationResult(
        scores=RemediationScores(
            structural_compliance=5,
            diagnostic_alignment=5,
            instructional_clarity=4,
            application_quality=4,
            tone_and_suitability=5,
        ),
        is_approved=True,
        remarks="Remediation material meets all instructional standards.",
    )


def evaluation_fail() -> RemediationEvaluationResult:
    return RemediationEvaluationResult(
        scores=RemediationScores(
            structural_compliance=2,
            diagnostic_alignment=3,
            instructional_clarity=3,
            application_quality=2,
            tone_and_suitability=3,
        ),
        is_approved=False,
        remarks="Section 5 is missing; tone is too clinical for grade level.",
    )


# ---- Quiz agent fixtures --------------------------------------------------

def diagnosis_quiz() -> DiagnosisResult:
    return DiagnosisResult(
        primary_misunderstanding="Visible muscle motion implies voluntary control.",
        common_error_patterns=["picks bicep as involuntary example"],
        flawed_mental_model="If I feel it move, I chose to move it.",
        root_cause="Awareness conflated with control.",
        missing_skills=["classify by control type"],
        intervention_hint="Anchor on heart and gut as the prototypical involuntary cases.",
    )


def quiz_items_default() -> list[QuizItem]:
    return [
        QuizItem(
            question_text="Which body part is controlled by involuntary muscles?",
            options={
                "A": "Your fingers when writing",
                "B": "Your heart pumping blood",
                "C": "Your legs when kicking a ball",
                "D": "Your arm when waving hello",
            },
            correct_answer="B",
            targeted_distractor_key="A",
            cognitive_level="Understanding",
            explanation="The heart is involuntary; option A reflects the 'felt = chosen' misconception.",
        ),
        QuizItem(
            question_text="What best describes how involuntary muscles work?",
            options={
                "A": "They only move when you decide to move them",
                "B": "They work automatically without conscious thought",
                "C": "They stop working when you sleep",
                "D": "They can be trained to follow commands",
            },
            correct_answer="B",
            targeted_distractor_key="A",
            cognitive_level="Understanding",
            explanation="Involuntary = automatic; option A is the conscious-control misconception.",
        ),
        QuizItem(
            question_text="Which pair correctly matches a muscle type to an example?",
            options={
                "A": "Voluntary - heart muscle",
                "B": "Involuntary - bicep muscle",
                "C": "Involuntary - stomach muscle",
                "D": "Voluntary - intestinal muscle",
            },
            correct_answer="C",
            targeted_distractor_key="A",
            cognitive_level="Applying",
            explanation="Stomach muscles are involuntary; option A swaps categories.",
        ),
    ]


def quiz_draft_default() -> QuizDraftResponse:
    return QuizDraftResponse(quiz_items=quiz_items_default())


def quiz_evaluation_pass() -> QuizEvaluationResult:
    return QuizEvaluationResult(
        scores=CriteriaScores(
            curriculum_alignment=5,
            content_validity=5,
            question_clarity=4,
            distractor_quality=5,
            item_writing_rules=5,
        ),
        eval_status="PASS",
        critique_summary="All items align with the diagnosis and meet psychometric standards.",
        revisions_required=[],
    )
