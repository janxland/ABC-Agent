"""Command line interface for ABC Agent."""

from __future__ import annotations

import argparse

from dotenv import load_dotenv

from .client import ABCAgent, AgentConfig


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run ABC Agent with SiliconFlow.")
    parser.add_argument("prompt", nargs="*", help="Prompt to send to the agent.")
    parser.add_argument("--model", help="Override SILICONFLOW_MODEL.")
    parser.add_argument("--stream", action="store_true", help="Stream the answer.")
    return parser


def main() -> None:
    load_dotenv()
    parser = build_parser()
    args = parser.parse_args()
    prompt = " ".join(args.prompt).strip()

    if not prompt:
        prompt = input("You: ").strip()

    agent = ABCAgent(AgentConfig.from_env(model=args.model))

    if args.stream:
        for text in agent.stream(prompt):
            print(text, end="", flush=True)
        print()
        return

    print(agent.run(prompt))
