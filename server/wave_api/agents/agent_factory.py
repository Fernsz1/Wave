from langchain_google_genai import ChatGoogleGenerativeAI
import os
from .agent_role import AgentRole
from dotenv import load_dotenv

class AgentFactory:
    """
    Factory for provisioning Google Gemini models tailored for specific agentic roles.
    """
    def __init__(self, api_key: str = None):
        load_dotenv()
        
        # 1. FIX: Correctly assign the instance variable, falling back to the .env file if None
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        
        if not self.api_key:
            raise ValueError("A Google API Key must be provided. Set GOOGLE_API_KEY in your .env or pass it explicitly.")

    def create_llm(self, role: AgentRole, **kwargs) -> ChatGoogleGenerativeAI:
        """
        Instantiates a LangChain Chat model based on the required operational role.
        """
        if role == AgentRole.PRIMARY:
            # gemini-2.5-flash: The workhorse. Ideal for fast, low-latency task execution.
            model_id = "gemini-2.5-flash"
            # Default to a moderate temperature for standard generation unless overridden
            temperature = kwargs.get("temperature", 0.5)
            
        elif role == AgentRole.EVALUATOR:
            # gemini-2.5-pro: The heavyweight. Used for deep reasoning, complex problem-solving, and strict grading.
            model_id = "gemini-2.5-pro"
            # Default to a highly deterministic temperature for consistent evaluation
            temperature = kwargs.get("temperature", 0.0) 
            
        else:
            raise ValueError(f"Unknown agent role requested: {role}")

        # 2. FIX: Explicitly pass the api_key to the LangChain wrapper
        return ChatGoogleGenerativeAI(
            model=model_id,
            google_api_key=self.api_key, 
            temperature=temperature,
            max_retries=kwargs.get("max_retries", 3),
        )