"""FastAPI app for ABC Agent."""

from __future__ import annotations

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .client import AgentConfig
from .react_agent import ReActAgent
from .schemas import ChatRequest, ChatResponse, SkillInfo
from .skills import SkillLoader
from .tools import ToolRegistry


load_dotenv()

app = FastAPI(title="ABC Agent API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/skills", response_model=list[SkillInfo])
def skills() -> list[SkillInfo]:
    loader = SkillLoader()
    registry = ToolRegistry(loader)
    tool_names_by_skill: dict[str, list[str]] = {}
    for tool in registry.list():
        if tool.skill_name:
            tool_names_by_skill.setdefault(tool.skill_name, []).append(tool.name)

    return [
        SkillInfo(
            name=skill.name,
            description=skill.description,
            path=str(skill.path),
            tools=tool_names_by_skill.get(skill.name, []),
        )
        for skill in loader.discover()
    ]


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        agent = ReActAgent(AgentConfig.from_env())
        answer, trace = agent.run(
            request.message,
            history=request.history,
            max_steps=request.max_steps,
        )
        return ChatResponse(answer=answer, trace=trace)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
