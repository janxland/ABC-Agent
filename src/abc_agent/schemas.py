"""Shared API and agent schemas."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system", "tool"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)
    max_steps: int = Field(default=6, ge=1, le=12)


class ToolCallRecord(BaseModel):
    name: str
    arguments: dict[str, Any]
    observation: Any
    ok: bool = True


class AgentTraceStep(BaseModel):
    step: int
    thought: str = ""
    action: Literal["tool", "final"]
    tool_call: Optional[ToolCallRecord] = None
    final: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    trace: list[AgentTraceStep]


class SkillInfo(BaseModel):
    name: str
    description: str
    path: str
    tools: list[str] = Field(default_factory=list)
