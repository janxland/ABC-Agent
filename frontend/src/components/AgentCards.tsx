import {
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileJson,
  FileMusic,
  FileText,
  Hammer,
  Loader2,
  TerminalSquare
} from "lucide-react";
import type { AgentStreamEvent, AgentTraceStep } from "../types";

interface FileReference {
  filename: string;
  path: string;
  size?: string;
}

interface Artifact {
  kind: string;
  label: string;
  path: string;
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function FileReferenceCards({ message }: { message: string }) {
  const files = extractFileReferences(message);
  if (files.length === 0) return null;

  return (
    <div className="card-grid">
      {files.map((file) => (
        <article className="agent-card file-card" key={file.path}>
          <div className="card-icon">
            <FileJson size={18} />
          </div>
          <div>
            <span className="card-kicker">Input file</span>
            <strong>{file.filename}</strong>
            <p>{file.path}</p>
            {file.size && <small>{file.size}</small>}
          </div>
        </article>
      ))}
    </div>
  );
}

export function TodoCards({ events }: { events: AgentStreamEvent[] }) {
  const todos = events.filter((event) => event.type === "todo.created");
  if (todos.length === 0) return null;

  return (
    <div className="todo-card">
      <div className="todo-head">
        <ClipboardList size={17} />
        <strong>Execution TODO</strong>
      </div>
      {todos.map((todo) => (
        <div className="todo-row" key={String(todo.id)}>
          <CheckCircle2 size={15} />
          <span>{String(todo.text)}</span>
        </div>
      ))}
    </div>
  );
}

export function ToolCards({ trace, events }: { trace?: AgentTraceStep[]; events?: AgentStreamEvent[] }) {
  const eventTools = (events ?? [])
    .filter((event) => event.type === "tool.completed" || event.type === "tool.failed")
    .map((event) => event.tool_call)
    .filter(Boolean);
  const traceTools = (trace ?? []).map((step) => step.tool_call).filter(Boolean);
  const tools = (traceTools.length > 0 ? traceTools : eventTools) as Array<Record<string, unknown>>;
  if (tools.length === 0) return null;

  return (
    <div className="card-grid">
      {tools.map((tool, index) => {
        const observation = tool.observation as Record<string, unknown> | undefined;
        return (
          <article className="agent-card tool-run-card" key={`${tool.name}-${index}`}>
            <div className="card-icon tool">
              <Hammer size={18} />
            </div>
            <div>
              <span className="card-kicker">Tool call</span>
              <strong>{String(tool.name)}</strong>
              <p>{summarizeArguments(tool.arguments)}</p>
              {observation?.title !== undefined && <small>result: {String(observation.title)}</small>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ArtifactCards({ artifacts, compact = false }: { artifacts: Artifact[]; compact?: boolean }) {
  if (artifacts.length === 0) return null;

  return (
    <div className={compact ? "artifact-list compact" : "artifact-list"}>
      {artifacts.map((artifact) => (
        <article className="artifact-card" key={artifact.path}>
          <div className="artifact-icon">
            {artifact.kind === "midi" ? <FileMusic size={17} /> : <FileText size={17} />}
          </div>
          <div>
            <strong>{artifact.label}</strong>
            <p>{artifact.path}</p>
          </div>
          <ExternalLink size={15} />
        </article>
      ))}
    </div>
  );
}

export function RunTimeline({ trace, streaming }: { trace?: AgentTraceStep[]; streaming?: boolean }) {
  if ((!trace || trace.length === 0) && !streaming) return null;
  return (
    <div className="timeline-card">
      <div className="timeline-head">
        <TerminalSquare size={16} />
        <strong>Run timeline</strong>
      </div>
      {streaming && (
        <div className="timeline-row active">
          <Loader2 size={15} />
          <span>Streaming run in progress</span>
        </div>
      )}
      {(trace ?? []).map((step) => (
        <div className="timeline-row" key={step.step}>
          {step.action === "tool" ? <Hammer size={15} /> : <CheckCircle2 size={15} />}
          <span>
            Step {step.step}: {step.action === "tool" ? step.tool_call?.name : "final answer"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function extractArtifacts(trace?: AgentTraceStep[]): Artifact[] {
  return (trace ?? []).flatMap((step) => {
    const observation = step.tool_call?.observation;
    if (!observation || typeof observation !== "object") return [];
    return normalizeArtifacts((observation as Record<string, unknown>).artifacts);
  });
}

function extractFileReferences(message: string): FileReference[] {
  return message
    .split("\n")
    .map((line) => line.match(/-\s*([^:]+):\s*(\/.+?)(?:\s+\(([^)]+)\))?$/))
    .filter(Boolean)
    .map((match) => ({
      filename: match?.[1]?.trim() ?? "file",
      path: match?.[2]?.trim() ?? "",
      size: match?.[3]
    }))
    .filter((file) => file.path.length > 0);
}

function normalizeArtifacts(value: unknown): Artifact[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item as Partial<Artifact>)
    .filter((item) => item.path && item.kind)
    .map((item) => ({
      kind: String(item.kind),
      label: String(item.label ?? item.kind),
      path: String(item.path)
    }));
}

function summarizeArguments(value: unknown) {
  if (!value || typeof value !== "object") return "No arguments";
  const args = value as Record<string, unknown>;
  if (args.source) return `source: ${String(args.source)}`;
  return JSON.stringify(args);
}
