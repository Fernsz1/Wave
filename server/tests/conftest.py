"""Shared pytest fixtures for the Wave server test suite."""
from __future__ import annotations

import os
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Make `tests` importable as a package from within tests files.
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

# AgentFactory() is constructed at module import time in nodes.py and refuses
# to load without a key. Tests never reach the real API because `stub_agents`
# replaces `create_llm` — but a placeholder must satisfy the constructor.
os.environ.setdefault("GOOGLE_API_KEY", "test-dummy-key-not-real")


def _install_langchain_stub() -> None:
    """Inject a stub `langchain_google_genai` module if the real one isn't
    available. Tests never call the real LLM — the agent stub replaces
    `create_llm` — but the module must import cleanly first."""
    if "langchain_google_genai" in sys.modules:
        return
    try:
        import langchain_google_genai  # noqa: F401
        return
    except ImportError:
        pass
    stub = types.ModuleType("langchain_google_genai")

    class _FakeChat:
        def __init__(self, *args, **kwargs):
            pass

        def with_structured_output(self, schema):
            raise RuntimeError("real LLM stub invoked — test forgot stub_agents fixture")

        def invoke(self, *args, **kwargs):
            raise RuntimeError("real LLM stub invoked — test forgot stub_agents fixture")

    stub.ChatGoogleGenerativeAI = _FakeChat
    sys.modules["langchain_google_genai"] = stub


def _install_dotenv_stub() -> None:
    if "dotenv" in sys.modules:
        return
    try:
        import dotenv  # noqa: F401
        return
    except ImportError:
        pass
    stub = types.ModuleType("dotenv")
    stub.load_dotenv = lambda *a, **kw: False
    sys.modules["dotenv"] = stub


_install_langchain_stub()
_install_dotenv_stub()


class _StubsHolder:
    """Module-level singleton holding the canned agent responses.

    Module-level so that the agent module's cached `primary_llm` (set on the
    first lazy import) keeps pointing at the same Stubs object across tests.
    Per-test mutations to its attributes are visible inside the running graph.
    """
    student_diagnosis = None
    draft_response = None
    lesson_evaluation = None
    quiz_diagnosis = None
    quiz_draft = None
    quiz_evaluation = None


@pytest.fixture
def stub_agents(monkeypatch):
    """Replace AgentFactory.create_llm with a scriptable stub.

    Returns the _StubsHolder singleton. Tests can reassign any attribute on it
    to script the next agent invocation (e.g. `stub_agents.draft_response =
    out.draft_simplified()`). The stub honors `with_structured_output(Schema)`
    and routes each schema to the appropriate canned response.
    """
    from tests.fixtures import agent_outputs as out
    from wave_api.agents.lesson_generation_agent.output_schema import (
        RemediationDraftResponse,
        RemediationEvaluationResult,
        StudentDiagnosis,
    )
    from wave_api.agents.quiz_generation_agent.output_schema import (
        DiagnosisResult,
        QuizDraftResponse,
        QuizEvaluationResult,
    )

    # Reset to defaults at the start of each test so prior mutations don't leak.
    Stubs = _StubsHolder
    Stubs.student_diagnosis = out.diagnosis_lesson()
    Stubs.draft_response = out.draft_default()
    Stubs.lesson_evaluation = out.evaluation_pass()
    Stubs.quiz_diagnosis = out.diagnosis_quiz()
    Stubs.quiz_draft = out.quiz_draft_default()
    Stubs.quiz_evaluation = out.quiz_evaluation_pass()

    schema_map = {
        StudentDiagnosis: lambda: Stubs.student_diagnosis,
        RemediationDraftResponse: lambda: Stubs.draft_response,
        RemediationEvaluationResult: lambda: Stubs.lesson_evaluation,
        DiagnosisResult: lambda: Stubs.quiz_diagnosis,
        QuizDraftResponse: lambda: Stubs.quiz_draft,
        QuizEvaluationResult: lambda: Stubs.quiz_evaluation,
    }

    from langchain_core.runnables import RunnableLambda

    def _make_structured_runnable(schema):
        factory = schema_map.get(schema)
        if factory is None:
            raise AssertionError(f"unstubbed schema {schema}")
        return RunnableLambda(lambda _inputs: factory())

    class _StubLLM(RunnableLambda):
        def __init__(self):
            super().__init__(lambda _i: Stubs.lesson_evaluation)

        def with_structured_output(self, schema):
            return _make_structured_runnable(schema)

    def _create_llm(self, _kind):
        return _StubLLM()

    monkeypatch.setattr(
        "wave_api.agents.agent_factory.AgentFactory.create_llm",
        _create_llm,
    )

    return Stubs
