# ABC-Agent

Python agent initialized for SiliconFlow.

## Setup

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

## Run

```bash
PYTHONPATH=src python -m abc_agent "你好，介绍一下你自己"
PYTHONPATH=src python -m abc_agent --stream "写一个 Python 快速开始计划"
```
