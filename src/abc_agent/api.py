"""FastAPI app for ABC Agent."""

from __future__ import annotations

from pathlib import Path
import os
import re
import time

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .client import AgentConfig
from .react_agent import ReActAgent
from .schemas import ChatRequest, ChatResponse, SkillInfo, TextUploadRequest, UploadResponse
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


def upload_dir() -> Path:
    workspace = Path(os.getenv("ABC_WORKSPACE_DIR", "./workspace")).expanduser().resolve()
    path = workspace / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


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


@app.post("/api/files/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)) -> UploadResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File is too large. Limit is 20 MB.")

    filename = _safe_upload_name(file.filename or "upload.txt")
    path = upload_dir() / f"{int(time.time() * 1000)}-{filename}"
    path.write_bytes(content)
    return _upload_response(path, filename)


@app.post("/api/files/text", response_model=UploadResponse)
def upload_text(request: TextUploadRequest) -> UploadResponse:
    content = request.content.encode("utf-8")
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Text is too large. Limit is 20 MB.")

    filename = _safe_upload_name(request.filename)
    path = upload_dir() / f"{int(time.time() * 1000)}-{filename}"
    path.write_bytes(content)
    return _upload_response(path, filename)


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


def _safe_upload_name(filename: str) -> str:
    name = Path(filename).name.strip() or "upload.txt"
    clean = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip(".-")
    return clean or "upload.txt"


def _upload_response(path: Path, filename: str) -> UploadResponse:
    text = path.read_text(encoding="utf-8", errors="replace")
    preview = text[:800]
    return UploadResponse(
        filename=filename,
        path=str(path),
        size_bytes=path.stat().st_size,
        preview=preview,
    )
