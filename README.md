# ABC-Agent

ABC-Agent is a Python ReAct agent powered by SiliconFlow, LangGraph orchestration,
local Skill loading, file-first tool inputs, and a React console for interactive use.

## Backend Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Put your SiliconFlow API key in `.env`:

```bash
SILICONFLOW_API_KEY=your_siliconflow_api_key_here
```

Run the API server:

```bash
PYTHONPATH=src uvicorn abc_agent.api:app --reload --host 127.0.0.1 --port 8000
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173.

## CLI

```bash
PYTHONPATH=src python -m abc_agent "你好，介绍一下你自己"
PYTHONPATH=src python -m abc_agent --stream "写一个 Python 快速开始计划"
PYTHONPATH=src python -m abc_agent --react "列出当前可用 skills"
```

## Architecture

- `abc_agent.langgraph_agent`: LangGraph ReAct loop with TODO events, tool execution, and OpenAI-style SSE chunks.
- `abc_agent.react_agent`: compatibility wrapper around the LangGraph runtime.
- `abc_agent.tools`: tool registry and skill-backed tool execution.
- `abc_agent.skills`: discovers local `SKILL.md` files from `ABC_SKILLS_DIR`.
- `abc_agent.api`: FastAPI backend for chat, streaming chat, file upload, health, and skills.
- `frontend`: Vite + React + TypeScript console with message cards, tool cards, file cards, artifacts, and run timeline.

## Streaming

`POST /api/chat/stream` returns Server-Sent Events using OpenAI-style `data: ...`
chunks and terminates with:

```text
data: [DONE]
```

ABC Agent also includes `abc_agent_event` payloads for TODO, tool, artifact, and
run lifecycle cards.
