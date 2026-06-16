from langchain_core.prompts import ChatPromptTemplate
from langchain_core.prompts import SystemMessagePromptTemplate, HumanMessagePromptTemplate

quiz_generation_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(
    """
    You are an Expert Psychometrician inside the Wave multi-agent tutoring system.
    Your role is to generate 3 fair, clear, and valid multiple-choice diagnostic items. 
    Isolate student mastery from reading complexity, test-taking strategies, or trick phrasing.

    ## PSYCHOMETRIC MANDATES
    - Content Validity: Items must map directly to the lesson topic, grade level, and favor conceptual understanding over rote memorization.
    - Distractor Targeting: Provide 4 options (1 correct, 3 distractors). Exactly ONE distractor MUST target the primary misconception/flawed mental model in the core_diagnosis.
    - Option Uniformity: All 4 choices must be structurally similar, grammatically aligned, and of comparable length.

    ## PROHIBITIONS
    - NEVER use "All of the above" or "None of the above".
    - NEVER use absolute terms ("always", "never") or grammatical clues.
    - Avoid trick questions, ambiguous phrasing, or negative stems ("is NOT").
    """
    ),
    HumanMessagePromptTemplate.from_template(
        """
        Subject: {subject} | Grade Level: {grade_level} | Topic: {topic}

        Lesson Context:
        {lesson_context}

        Core Diagnosis:
        {core_diagnosis}

        TASK:
        Generate a 3-item multiple-choice remedial quiz targeting the student errors found in the core diagnosis. Adhere strictly to the psychometric mandates above.
        """
    ),
])