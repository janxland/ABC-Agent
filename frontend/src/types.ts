export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  tools: string[];
}

export interface ToolCallRecord {
  name: string;
  arguments: Record<string, unknown>;
  observation: unknown;
  ok: boolean;
}

export interface AgentTraceStep {
  step: number;
  thought: string;
  action: "tool" | "final";
  tool_call?: ToolCallRecord | null;
  final?: string | null;
}

export interface ChatResponse {
  answer: string;
  trace: AgentTraceStep[];
}

export interface ConversationTurn {
  id: string;
  user: string;
  assistant?: string;
  trace?: AgentTraceStep[];
  events?: AgentStreamEvent[];
  streaming?: boolean;
  error?: string;
}

export interface UploadResponse {
  filename: string;
  path: string;
  size_bytes: number;
  preview: string;
}

export interface AgentStreamEvent {
  type: string;
  [key: string]: unknown;
}
