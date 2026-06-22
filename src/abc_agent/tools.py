"""Tool registry and skill-backed tools."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import importlib.util
import json
import os
import sys
from typing import Any, Callable

from .skills import SkillLoader


ToolHandler = Callable[[dict[str, Any]], Any]


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    handler: ToolHandler
    skill_name: str | None = None


class ToolRegistry:
    def __init__(self, skill_loader: SkillLoader | None = None) -> None:
        self.skill_loader = skill_loader or SkillLoader()
        self._tools: dict[str, Tool] = {}
        self._register_builtin_tools()
        self._register_skill_tools()

    def list(self) -> list[Tool]:
        return list(self._tools.values())

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def run(self, name: str, arguments: dict[str, Any]) -> Any:
        tool = self.get(name)
        if not tool:
            raise ValueError(f"Unknown tool: {name}")
        return tool.handler(arguments)

    def to_prompt_specs(self) -> list[dict[str, Any]]:
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.parameters,
            }
            for tool in self.list()
        ]

    def _add(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def _register_builtin_tools(self) -> None:
        self._add(
            Tool(
                name="list_skills",
                description="List discovered local skills and what they can do.",
                parameters={"type": "object", "properties": {}, "additionalProperties": False},
                handler=lambda _: [
                    {
                        "name": skill.name,
                        "description": skill.description,
                        "path": str(skill.path),
                    }
                    for skill in self.skill_loader.discover()
                ],
            )
        )
        self._add(
            Tool(
                name="read_skill",
                description="Read a local skill guide by exact skill name.",
                parameters={
                    "type": "object",
                    "properties": {"name": {"type": "string"}},
                    "required": ["name"],
                    "additionalProperties": False,
                },
                handler=self._read_skill,
            )
        )

    def _register_skill_tools(self) -> None:
        for skill in self.skill_loader.discover():
            if skill.name == "sky-music-tools":
                self._add(
                    Tool(
                        name="sky_music_convert",
                        description=(
                            "Convert Sky/CUBY game score JSON into ABC notation, "
                            "abcjs HTML, and optionally MIDI."
                        ),
                        parameters={
                            "type": "object",
                            "properties": {
                                "source": {
                                    "type": "string",
                                    "description": "JSON text or an absolute path to a .json/.txt score file.",
                                },
                                "output_name": {
                                    "type": "string",
                                    "description": "Folder/file base name for generated artifacts.",
                                },
                                "make_midi": {"type": "boolean", "default": True},
                                "instrument": {"type": "integer", "default": 0},
                            },
                            "required": ["source"],
                            "additionalProperties": False,
                        },
                        handler=lambda args, skill_path=skill.path: self._sky_music_convert(skill_path, args),
                        skill_name=skill.name,
                    )
                )

    def _read_skill(self, arguments: dict[str, Any]) -> dict[str, str]:
        name = str(arguments.get("name", ""))
        skill = self.skill_loader.get(name)
        if not skill:
            raise ValueError(f"Skill not found: {name}")
        return {"name": skill.name, "description": skill.description, "body": skill.body}

    def _sky_music_convert(self, skill_path: Path, arguments: dict[str, Any]) -> dict[str, Any]:
        source = str(arguments["source"])
        output_name = str(arguments.get("output_name") or "sky-score")
        make_midi = bool(arguments.get("make_midi", True))
        instrument = int(arguments.get("instrument", 0))

        workspace = Path(os.getenv("ABC_WORKSPACE_DIR", "./workspace")).expanduser().resolve()
        output_dir = workspace / f"{_safe_name(output_name)}-score"
        output_dir.mkdir(parents=True, exist_ok=True)

        _prepend_path(skill_path)
        parser = _load_module(skill_path / "tools" / "parser.py", "sky_parser")
        abc_writer = _load_module(skill_path / "tools" / "abc_writer.py", "sky_abc_writer")
        renderer = _load_module(skill_path / "tools" / "renderer.py", "sky_renderer")

        score = parser.parse_game_score(source)
        abc_text = abc_writer.to_abc_notation(score)
        abc_path = output_dir / "score.abc"
        html_path = output_dir / "index.html"
        abc_path.write_text(abc_text, encoding="utf-8")
        renderer.render_abcjs_html(abc_text, str(html_path), title=score.title)

        result: dict[str, Any] = {
            "title": score.title,
            "bpm": score.bpm,
            "key": score.key,
            "duration_ms": round(score.duration_ms(), 2),
            "abc": abc_text,
            "abc_path": str(abc_path),
            "html_path": str(html_path),
        }

        if make_midi:
            try:
                midi_writer = _load_module(skill_path / "tools" / "midi_writer.py", "sky_midi_writer")
                midi_path = output_dir / "score.mid"
                midi_writer.to_midi(score, str(midi_path), instrument=instrument, add_expression=True)
                result["midi_path"] = str(midi_path)
            except Exception as exc:
                result["midi_error"] = str(exc)

        return result


def _safe_name(value: str) -> str:
    clean = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in value.strip())
    return clean.strip("-") or "output"


def _prepend_path(path: Path) -> None:
    text = str(path)
    if text not in sys.path:
        sys.path.insert(0, text)


def _load_module(path: Path, name: str) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if not spec or not spec.loader:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def coerce_tool_arguments(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        return json.loads(value)
    raise TypeError("Tool arguments must be an object or JSON string.")
