# ABC-Agent

ABC-Agent is a Python ReAct agent powered by SiliconFlow, with local Skill loading
and a React console for interactive use.

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

- `abc_agent.react_agent`: ReAct loop with JSON decisions and trace records.
- `abc_agent.tools`: tool registry and skill-backed tool execution.
- `abc_agent.skills`: discovers local `SKILL.md` files from `ABC_SKILLS_DIR`.
- `abc_agent.api`: FastAPI backend for chat, health, and skills.
- `frontend`: Vite + React + TypeScript console.
