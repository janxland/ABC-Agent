"""SiliconFlow-backed ABC Agent."""

from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Iterator

from openai import OpenAI


DEFAULT_BASE_URL = "https://api.siliconflow.cn/v1"
DEFAULT_MODEL = "Qwen/Qwen2.5-72B-Instruct"
DEFAULT_SYSTEM_PROMPT = (
    "You are ABC Agent, a concise and practical assistant. "
    "Answer in the user's language, keep implementation advice actionable, "
    "and ask a clarifying question only when the request cannot be completed safely."
)


@dataclass(frozen=True)
class AgentConfig:
    api_key: str
    base_url: str = DEFAULT_BASE_URL
    model: str = DEFAULT_MODEL
    system_prompt: str = DEFAULT_SYSTEM_PROMPT

    @classmethod
    def from_env(cls, model: str | None = None) -> "AgentConfig":
        api_key = os.getenv("SILICONFLOW_API_KEY")
        if not api_key:
            raise RuntimeError(
                "SILICONFLOW_API_KEY is not set. Copy .env.example to .env "
                "or export it in your shell before running ABC Agent."
            )

        return cls(
            api_key=api_key,
            base_url=os.getenv("SILICONFLOW_BASE_URL", DEFAULT_BASE_URL),
            model=model or os.getenv("SILICONFLOW_MODEL", DEFAULT_MODEL),
        )


class ABCAgent:
    def __init__(self, config: AgentConfig) -> None:
        self.config = config
        self.client = OpenAI(api_key=config.api_key, base_url=config.base_url)

    def run(self, prompt: str) -> str:
        response = self.client.chat.completions.create(
            model=self.config.model,
            messages=[
                {"role": "system", "content": self.config.system_prompt},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content or ""

    def stream(self, prompt: str) -> Iterator[str]:
        response = self.client.chat.completions.create(
            model=self.config.model,
            messages=[
                {"role": "system", "content": self.config.system_prompt},
                {"role": "user", "content": prompt},
            ],
            stream=True,
        )

        for chunk in response:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
