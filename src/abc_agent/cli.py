"""Command line interface for ABC Agent."""

from __future__ import annotations

import argparse

from dotenv import load_dotenv

from .client import ABCAgent, AgentConfig
from .react_agent import ReActAgent


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run ABC Agent with SiliconFlow.")
    parser.add_argument("prompt", nargs="*", help="Prompt to send to the agent.")
    parser.add_argument("--model", help="Override SILICONFLOW_MODEL.")
    parser.add_argument("--stream", action="store_true", help="Stream the answer.")
    parser.add_argument("--react", action="store_true", help="Run the ReAct agent loop.")
    parser.add_argument("--max-steps", type=int, default=6, help="Max ReAct steps.")
    return parser


def main() -> None:
    load_dotenv()
    parser = build_parser()
    args = parser.parse_args()
    prompt = " ".join(args.prompt).strip()

    if not prompt:
        prompt = input("You: ").strip()

    config = AgentConfig.from_env(model=args.model)

    if args.react:
        agent = ReActAgent(config)
        answer, trace = agent.run(prompt, max_steps=args.max_steps)
        for item in trace:
            if item.tool_call:
                print(f"[step {item.step}] {item.tool_call.name}: {item.tool_call.observation}")
        print(answer)
        return

    agent = ABCAgent(config)

    if args.stream:
        for text in agent.stream(prompt):
            print(text, end="", flush=True)
        print()
        return

    print(agent.run(prompt))
