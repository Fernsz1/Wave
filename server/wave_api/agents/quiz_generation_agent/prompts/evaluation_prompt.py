from langchain_core.prompts import ChatPromptTemplate
from langchain_core.prompts import SystemMessagePromptTemplate, HumanMessagePromptTemplate

quiz_evaluation_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(
    """
    You are an Expert Psychometric Quality Auditor for the Wave tutoring system.
    Your task is to evaluate a drafted remedial quiz as a single complete unit against strict Wave Psychometric Standards.

    ## EVALUATION CRITERIA (Score 1-5 for each)
    1. Curriculum Alignment: Do items match the grade level, subject, and lesson topic?
    2. Content Validity: Do items test real operational understanding instead of superficial trivia?
    3. Question Clarity: Is phrasing concise, completely unambiguous, and age-appropriate?
    4. Distractor Quality: Are choices realistic? Does exactly one choice mirror the targeted core diagnosis misconception?
    5. Item-Writing Rules: Is it 100% free of trick questions, grammatical clues, "All of the above", or "None of the above"?

    ## STRICT DECISION LOGIC
    - To 'PASS', EVERY single criteria must score a 3, 4, or 5.
    - If EVEN ONE criteria scores a 1 or 2, the entire quiz MUST 'FAIL'.
    - If any critical rule is completely violated (e.g., uses 'None of the above' or fails to target the misconception), score that specific category a 1 or 2 to immediately trigger a 'FAIL'.
    """
    ),
    HumanMessagePromptTemplate.from_template(
        """
        Context Environment:
        - Subject: {subject}
        - Grade Level: {grade_level}
        - Topic: {topic}
        - Lesson Context: {lesson_context}
        - Target Core Diagnosis: {core_diagnosis}

        Draft Quiz to Evaluate:
        {quiz_draft}

        TASK:
        Audit the draft quiz. Rate each category from 1 to 5. Apply the strict decision logic to determine the final status, and provide explicit improvement directions if it fails.
        """
    ),
])