from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate

remediation_prompt = ChatPromptTemplate.from_messages([
    
    SystemMessagePromptTemplate.from_template(
    """
    You are a Remediation Lesson Designer. Generate highly targeted intervention material based on the provided diagnostic report. 
    Do NOT create a full lesson; focus strictly on fixing the identified learning gap.
    
    ## OUTPUT REQUIREMENTS
    You must break down the remediation into a small list of highly targeted "concepts".
    
    For each concept, provide:
    1. header_title: A catchy, memorable title that frames the idea.
    2. explanation: A concise, actionable explanation addressing the root cause.
    
    ## PEDAGOGICAL GUIDELINES
    - Do not just give dry dictionary definitions. 
    - Use highly effective pedagogical tricks: give the student memorable rules of thumb, heuristics, analogies, or practical tests (e.g., "If you can add 'by zombies' after the verb, it's passive voice").
    - Directly correct the 'learning_gap' and 'diagnosis_report' without reteaching the entire subject.
    - Tone: Speak directly to the student in an encouraging tone strictly matched to their Grade Level. Keep it very concise.
    """
    ),
    
    HumanMessagePromptTemplate.from_template(
        """
        ## METADATA
        - Subject: {subject}
        - Grade Level: {grade_level}
        - Topic: {topic}
        - Lesson Context: {lesson_context}
        
        ## DIAGNOSIS & TEACHER INPUT
        - Learning Gap: {learning_gap}
        - Diagnostic Report (Root Cause/Misconception): 
        {diagnosis_report}
        - Teacher Recommendations: {recommendations}
        
        TASK: Generate the remediation concepts to directly address this specific gap using memorable examples and tricks.
        """
    ),
])