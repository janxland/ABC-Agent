import type { AgentStreamEvent, ChatMessage, ChatResponse, SkillInfo, UploadResponse } from "./types";

export async function fetchSkills(): Promise<SkillInfo[]> {
  const response = await fetch("/api/skills");
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch("/api/health");
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendMessage(
  message: string,
  history: ChatMessage[],
  maxSteps: number
): Promise<ChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, max_steps: maxSteps })
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

export async function streamMessage(
  message: string,
  history: ChatMessage[],
  maxSteps: number,
  handlers: {
    onContent: (content: string) => void;
    onEvent: (event: AgentStreamEvent) => void;
  }
): Promise<void> {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, max_steps: maxSteps })
  });

  if (!response.ok || !response.body) {
    throw new Error(await readError(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part
        .split("\n")
        .find((item) => item.startsWith("data:"));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      const payload = JSON.parse(data);
      if (payload.abc_agent_event) {
        handlers.onEvent(payload.abc_agent_event);
      }
      const delta = payload.choices?.[0]?.delta?.content;
      if (delta) {
        handlers.onContent(delta);
      }
    }
  }
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/files/upload", {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

export async function uploadText(content: string, filename: string): Promise<UploadResponse> {
  const response = await fetch("/api/files/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, filename })
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.detail || JSON.stringify(data);
  } catch {
    return response.statusText;
  }
}
