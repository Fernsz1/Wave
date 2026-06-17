from langchain_core.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate
)

# --- THE SHARED SYSTEM PROMPT ---
quiz_system_prompt = SystemMessagePromptTemplate.from_template("""
You are an expert Psychometrician and Assessment Designer. Your task is to generate a collection of highly targeted remediation quiz items based on a student's core misconception diagnosis.

CRITICAL STRUCTURAL REQUIREMENT:
You must structure your response to perfectly match the requested schema. Every single quiz item must include:
1. question_text: Age-appropriate, clear stem. No absolute terms like 'always' or 'never'.
2. options: Exactly 4 choices mapped to keys 'A', 'B', 'C', and 'D'. 
3. correct_answer: The single, unquestionably correct answer key letter.
4. targeted_distractor_key: The incorrect choice that explicitly mimics the student's flawed mental model from the core diagnosis.
5. cognitive_level: The specific Bloom's Taxonomy level tested.

## REVISION INSTRUCTIONS
You are rewriting a previous quiz draft. Your goal is to adapt the entire material to explicitly satisfy the critical revision request from the teacher while keeping items strictly tethered to the core diagnosis gaps.
""")


# =====================================================================
# Variation 1: Make Harder (Accepts: subject, grade_level, topic, quiz_draft, human_feedback)
# =====================================================================
prompt_make_harder = ChatPromptTemplate.from_messages([
    quiz_system_prompt,
    HumanMessagePromptTemplate.from_template("""
Subject: {subject}
Grade Level: {grade_level}
Topic: {topic}

---
CRITICAL REVISION REQUEST FROM THE TEACHER:
"The current quiz draft is too easy. Please increase the rigor of the questions. Shift the cognitive levels up on Bloom's Taxonomy (e.g., move from simple 'Understanding' to deep 'Applying' or 'Analyzing'). Ensure that all distractors are highly sophisticated, plausible, and attractive options that require precise critical thinking to eliminate."

Additional Teacher Context/Notes:
{human_feedback}

Previous Quiz Draft to Modify:
{quiz_draft}
""")
])


# =====================================================================
# Variation 2: Make Easier (Accepts: subject, grade_level, topic, quiz_draft, human_feedback)
# =====================================================================
prompt_make_easier = ChatPromptTemplate.from_messages([
    quiz_system_prompt,
    HumanMessagePromptTemplate.from_template("""
Subject: {subject}
Grade Level: {grade_level}
Topic: {topic}

---
CRITICAL REVISION REQUEST FROM THE TEACHER:
"The current quiz draft is too complex and intimidating for this grade level. Please reduce the linguistic complexity and cognitive load. Focus the items on fundamental conceptual checks (e.g., 'Remembering' or basic 'Understanding'). Simplify the sentence structures in the stems, and make sure incorrect options don't rely on wordplay or tricky vocabulary."

Additional Teacher Context/Notes:
{human_feedback}

Previous Quiz Draft to Modify:
{quiz_draft}
""")
])


# =====================================================================
# Variation 3: Change Context (Accepts: subject, grade_level, topic, quiz_draft, human_feedback)
# =====================================================================
prompt_change_context = ChatPromptTemplate.from_messages([
    quiz_system_prompt,
    HumanMessagePromptTemplate.from_template("""
Subject: {subject}
Grade Level: {grade_level}
Topic: {topic}

---
CRITICAL REVISION REQUEST FROM THE TEACHER:
"The quiz logic and difficulty levels are correct, but the scenarios are disengaging or abstract. Please completely swap out the real-world contexts, themes, or word-problem backstories used in the question stems. Replace them with fresh, highly relatable scenarios fitting for this grade level, while keeping the psychometric structure and tested core mechanics identical."

Additional Teacher Context/Notes:
{human_feedback}

Previous Quiz Draft to Modify:
{quiz_draft}
""")
])


# =====================================================================
# Variation 4: Regenerate Distractors Only (Accepts: subject, grade_level, topic, quiz_draft, human_feedback)
# =====================================================================
prompt_fix_distractors = ChatPromptTemplate.from_messages([
    quiz_system_prompt,
    HumanMessagePromptTemplate.from_template("""
Subject: {subject}
Grade Level: {grade_level}
Topic: {topic}

---
CRITICAL REVISION REQUEST FROM THE TEACHER:
"The question stems and the correct answers from the previous draft are solid, but the wrong choices (distractors) need re-engineering. Keep the core questions exactly as they are, but rewrite the incorrect options. Make them track much closer to the student's core diagnosis so they capture common execution mistakes or flawed reasoning patterns effectively."

Additional Teacher Context/Notes:
{human_feedback}

Previous Quiz Draft to Modify:
{quiz_draft}
""")
])