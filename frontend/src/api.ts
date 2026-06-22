import type { ChatMessage, ChatResponse, SkillInfo, UploadResponse } from "./types";

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
