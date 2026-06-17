
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate

# --- THE UNIFIED SYSTEM PROMPT ---
teacher_remediation_prompt = ChatPromptTemplate.from_messages([
    
    SystemMessagePromptTemplate.from_template("""
You are a Remediation Lesson Designer. Generate highly targeted intervention material based on the provided diagnostic report. Do NOT create a full lesson; focus strictly on fixing the identified gaps.

CRITICAL CONSTRAINT: Your entire output MUST be incredibly concise, totaling strictly around 250 words. You must follow this length constraint even during revisions!

## OUTPUT STRUCTURE (Use Markdown)
### 1. Focus Area (1 sentence)
### 2. Concept Review (2 sentences max)
### 3. The Mistake (1-2 sentences)
### 4. Correct Approach (2-3 brief steps)
### 5. Guided Example
### 6. Practice (1 problem)
### 7. Mastery Check
### 8. Key Takeaways

---

## REVISION INSTRUCTIONS
If a previous draft and teacher feedback are provided below, your task is to REWRITE the material. You must preserve the 8-part structure and the ~250-word constraint, but completely adapt the content to satisfy the teacher's specific requested adjustment.
""")])
from langchain_core.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate
)

system_prompt = SystemMessagePromptTemplate.from_template("""
You are a Remediation Lesson Designer. Generate highly targeted intervention material based on the provided diagnostic report. Do NOT create a full lesson; focus strictly on fixing the identified gaps.

CRITICAL CONSTRAINT: Your entire output MUST be incredibly concise, totaling strictly around 250 words.

## OUTPUT STRUCTURE (Use Markdown)
### 1. Focus Area (1 sentence)
### 2. Concept Review (2 sentences max)
### 3. The Mistake (1-2 sentences)
### 4. Correct Approach (2-3 brief steps)
### 5. Guided Example
### 6. Practice (1 problem)
### 7. Mastery Check
### 8. Key Takeaways
""")

# Button 1: Simplify Explanation
simplify_prompt = ChatPromptTemplate.from_messages([
    system_prompt,
    HumanMessagePromptTemplate.from_template("""
Subject: {subject}
Grade Level: {grade_level}
Topic: {topic}
Diagnostic Report: {diagnosis_report}
Teacher Recommendations: {recommendations}

---
CRITICAL REVISION REQUEST FROM THE TEACHER:
"The current explanation is too complex for this grade level. Please simplify the language, break down technical jargon into plain terms, and use a simpler, more relatable analogy or step-by-step logic in the Concept Review and Correct Approach sections."

Previous Draft to Fix:
{draft_lesson}
""")
])


# Button 2: More Practical / Concrete
practical_prompt = ChatPromptTemplate.from_messages([
    system_prompt,
    HumanMessagePromptTemplate.from_template("""
Subject: {subject}
Grade Level: {grade_level}
Topic: {topic}
Diagnostic Report: {diagnosis_report}
Teacher Recommendations: {recommendations}
---
CRITICAL REVISION REQUEST FROM THE TEACHER:
"The lesson is too theoretical. Please make it more practical and concrete. Rewrite the Concept Review using a real-world physical analogy, and ensure the Guided Example and Practice problem use highly contextual, practical scenarios instead of abstract equations or code."

Previous Draft to Fix:
{draft_lesson}
""")
])


# Button 3: Change Example & Practice
change_exercise_prompt = ChatPromptTemplate.from_messages([
    system_prompt,
    HumanMessagePromptTemplate.from_template("""
Subject: {subject}
Grade Level: {grade_level}
Topic: {topic}
Diagnostic Report: {diagnosis_report}
Teacher Recommendations: {recommendations}

---
CRITICAL REVISION REQUEST FROM THE TEACHER:
"Keep the conceptual explanations from the previous draft, but completely swap out the Guided Example, the Practice problem, and the Mastery Check. Generate entirely new problems that approach the misconception from a different angle."

Previous Draft to Fix:
{draft_lesson}
""")
])


# Button 4: Break Down Into Smaller Steps
micro_steps_prompt = ChatPromptTemplate.from_messages([
    system_prompt,
    HumanMessagePromptTemplate.from_template("""
Subject: {subject}
Grade Level: {grade_level}
Topic: {topic}
Diagnostic Report: {diagnosis_report}
Teacher Recommendations: {recommendations}

---
CRITICAL REVISION REQUEST FROM THE TEACHER:
"The student understands the core concept but gets lost in the execution. Please break down the 'Correct Approach' and 'Guided Example' sections into smaller, distinct micro-steps. Explicitly show the transition between each step so the student doesn't skip over key details or calculations."

Previous Draft to Fix:
{draft_lesson}
""")
])