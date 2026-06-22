"""Skill discovery and loading."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import re


DEFAULT_SKILLS_DIR = "/Users/Admin1/Downloads/.magic/skills"


@dataclass(frozen=True)
class Skill:
    name: str
    description: str
    path: Path
    body: str


class SkillLoader:
    def __init__(self, skills_dir: str | Path | None = None) -> None:
        root = skills_dir or os.getenv("ABC_SKILLS_DIR") or DEFAULT_SKILLS_DIR
        self.skills_dir = Path(root).expanduser()

    def discover(self) -> list[Skill]:
        if not self.skills_dir.exists():
            return []

        skills: list[Skill] = []
        for skill_md in sorted(self.skills_dir.glob("*/SKILL.md")):
            skill = self._load_skill(skill_md)
            if skill:
                skills.append(skill)
        return skills

    def get(self, name: str) -> Skill | None:
        normalized = name.strip().lower()
        for skill in self.discover():
            if skill.name.lower() == normalized:
                return skill
        return None

    def _load_skill(self, skill_md: Path) -> Skill | None:
        text = skill_md.read_text(encoding="utf-8")
        metadata, body = self._split_frontmatter(text)
        name = metadata.get("name") or skill_md.parent.name
        description = (
            metadata.get("description-cn")
            or metadata.get("description")
            or self._first_non_empty_line(body)
            or ""
        )
        return Skill(name=name, description=description, path=skill_md.parent, body=body)

    @staticmethod
    def _split_frontmatter(text: str) -> tuple[dict[str, str], str]:
        if not text.startswith("---"):
            return {}, text

        match = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", text, re.DOTALL)
        if not match:
            return {}, text

        raw_meta, body = match.groups()
        metadata: dict[str, str] = {}
        for line in raw_meta.splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            metadata[key.strip()] = value.strip().strip('"').strip("'")
        return metadata, body

    @staticmethod
    def _first_non_empty_line(text: str) -> str:
        for line in text.splitlines():
            clean = line.strip().lstrip("#").strip()
            if clean:
                return clean
        return ""
