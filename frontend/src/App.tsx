import {
  Activity,
  Bot,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Code2,
  DatabaseZap,
  FileJson,
  FileText,
  Gauge,
  Hammer,
  History,
  Layers3,
  Loader2,
  MessageSquareText,
  PanelRightOpen,
  Play,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Upload,
  X,
  UserRound,
  Workflow
} from "lucide-react";
import { ClipboardEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { checkHealth, fetchSkills, sendMessage, streamMessage, uploadFile, uploadText } from "./api";
import {
  ArtifactCards,
  FileReferenceCards,
  RunTimeline,
  TodoCards,
  ToolCards,
  extractArtifacts,
  formatBytes
} from "./components/AgentCards";
import type {
  AgentStreamEvent,
  AgentTraceStep,
  ChatMessage,
  ConversationTurn,
  SkillInfo,
  UploadResponse
} from "./types";

const starterPrompts = [
  "列出当前可用 skills，并说明每个 skill 能做什么",
  "用 ReAct 解释一下你会如何处理一个 Sky 谱转 ABC 的任务",
  "把当前 Agent 的工具调用流程用步骤说明给我"
];

function formatObservation(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function lastTrace(turns: ConversationTurn[]): AgentTraceStep[] {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index].trace?.length) return turns[index].trace ?? [];
  }
  return [];
}

function guessPasteFilename(content: string) {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "pasted-score.json";
  if (/^X:\s*\d+/m.test(content) || /^K:/m.test(content)) return "pasted-score.abc";
  return "pasted-content.txt";
}

export function App() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [online, setOnline] = useState(false);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [input, setInput] = useState("");
  const [maxSteps, setMaxSteps] = useState(6);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [attachments, setAttachments] = useState<UploadResponse[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [skillError, setSkillError] = useState("");
  const [selectedTraceIndex, setSelectedTraceIndex] = useState(0);

  const history = useMemo<ChatMessage[]>(() => {
    return turns.flatMap((turn) => {
      const messages: ChatMessage[] = [{ role: "user", content: turn.user }];
      if (turn.assistant) {
        messages.push({ role: "assistant", content: turn.assistant });
      }
      return messages;
    });
  }, [turns]);

  const toolCount = skills.reduce((total, skill) => total + skill.tools.length, 0);
  const trace = lastTrace(turns);
  const selectedTrace = trace[selectedTraceIndex] ?? trace[0];
  const completedTasks = turns.filter((turn) => turn.assistant).length;

  async function refreshRuntime() {
    const isOnline = await checkHealth();
    setOnline(isOnline);

    try {
      setSkills(await fetchSkills());
      setSkillError("");
    } catch (error) {
      setSkillError(error instanceof Error ? error.message : "技能加载失败");
    }
  }

  useEffect(() => {
    refreshRuntime();
  }, []);

  useEffect(() => {
    setSelectedTraceIndex(0);
  }, [trace.length]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = buildMessage(input.trim());
    if (!message || loading || uploading) return;

    const id = crypto.randomUUID();
    setInput("");
    setAttachments([]);
    setLoading(true);
    setTurns((current) => [...current, { id, user: message, assistant: "", events: [], streaming: true }]);

    try {
      await streamMessage(message, history, maxSteps, {
        onContent: (content) => {
          setTurns((current) =>
            current.map((turn) =>
              turn.id === id
                ? { ...turn, assistant: `${turn.assistant ?? ""}${content}` }
                : turn
            )
          );
        },
        onEvent: (streamEvent: AgentStreamEvent) => {
          setTurns((current) =>
            current.map((turn) => {
              if (turn.id !== id) return turn;
              const nextEvents = [...(turn.events ?? []), streamEvent];
              const trace =
                streamEvent.type === "run.completed" && Array.isArray(streamEvent.trace)
                  ? (streamEvent.trace as AgentTraceStep[])
                  : turn.trace;
              return { ...turn, events: nextEvents, trace };
            })
          );
        }
      });
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, streaming: false } : turn))
      );
    } catch (error) {
      try {
        const response = await sendMessage(message, history, maxSteps);
        setTurns((current) =>
          current.map((turn) =>
            turn.id === id
              ? { ...turn, assistant: response.answer, trace: response.trace, streaming: false }
              : turn
          )
        );
      } catch (fallbackError) {
        setTurns((current) =>
          current.map((turn) =>
            turn.id === id
              ? {
                  ...turn,
                  streaming: false,
                  error:
                    fallbackError instanceof Error
                      ? fallbackError.message
                      : error instanceof Error
                        ? error.message
                        : "请求失败"
                }
              : turn
          )
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function buildMessage(text: string) {
    const fileContext = attachments
      .map(
        (file) =>
          `- ${file.filename}: ${file.path} (${formatBytes(file.size_bytes)})`
      )
      .join("\n");

    if (!fileContext) return text;

    return [
      text || "请处理这些已上传文件。",
      "",
      "已上传文件路径如下，请优先把 path 作为 tool 的 source 参数，不要要求我粘贴全文：",
      fileContext
    ].join("\n");
  }

  async function handleFiles(files: FileList | File[]) {
    const items = Array.from(files).filter((file) => file.size > 0);
    if (items.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await Promise.all(items.map((file) => uploadFile(file)));
      setAttachments((current) => [...current, ...uploaded]);
    } catch (error) {
      setSkillError(error instanceof Error ? error.message : "文件上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = event.clipboardData.files;
    if (files.length > 0) {
      event.preventDefault();
      await handleFiles(files);
      return;
    }

    const text = event.clipboardData.getData("text");
    if (text.length < 1600) return;

    event.preventDefault();
    setUploading(true);
    try {
      const uploaded = await uploadText(text, guessPasteFilename(text));
      setAttachments((current) => [...current, uploaded]);
      setInput((current) =>
        current.trim()
          ? current
          : "请读取刚粘贴保存的文件，并根据内容选择合适的 skill/tool 处理。"
      );
    } catch (error) {
      setSkillError(error instanceof Error ? error.message : "粘贴内容保存失败");
    } finally {
      setUploading(false);
    }
  }

  function handleDragOver(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLFormElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDragActive(false);
    }
  }

  async function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setDragActive(false);
    await handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="app-shell">
      <aside className="left-rail">
        <div className="brand">
          <div className="brand-mark">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h1>ABC Agent</h1>
            <p>ReAct orchestration studio</p>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Agent sections">
          <button className="nav-item active">
            <MessageSquareText size={18} />
            <span>Console</span>
          </button>
          <button className="nav-item">
            <Workflow size={18} />
            <span>Runs</span>
          </button>
          <button className="nav-item">
            <Boxes size={18} />
            <span>Skills</span>
          </button>
          <button className="nav-item">
            <DatabaseZap size={18} />
            <span>Artifacts</span>
          </button>
        </nav>

        <section className="panel runtime-panel">
          <div className="panel-title">
            <span>Runtime</span>
            <button className="icon-button" onClick={refreshRuntime} aria-label="刷新运行状态">
              <RefreshCcw size={16} />
            </button>
          </div>
          <div className={online ? "status online" : "status offline"}>
            {online ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
            <span>{online ? "API connected" : "API offline"}</span>
          </div>
          <div className="runtime-grid">
            <div>
              <strong>{skills.length}</strong>
              <span>Skills</span>
            </div>
            <div>
              <strong>{toolCount}</strong>
              <span>Tools</span>
            </div>
          </div>
          <label className="range-label">
            <span>Max ReAct steps</span>
            <strong>{maxSteps}</strong>
          </label>
          <input
            type="range"
            min="1"
            max="12"
            value={maxSteps}
            onChange={(event) => setMaxSteps(Number(event.target.value))}
          />
        </section>

        <section className="panel skills-panel">
          <div className="panel-title">
            <span>Loaded skills</span>
            <span className="count">{skills.length}</span>
          </div>
          {skillError && <div className="error-inline">{skillError}</div>}
          <div className="skill-list">
            {skills.map((skill) => (
              <article className="skill-item" key={skill.name}>
                <div className="skill-head">
                  <Sparkles size={16} />
                  <strong>{skill.name}</strong>
                </div>
                <p>{skill.description}</p>
                {skill.tools.length > 0 && (
                  <div className="tool-pills">
                    {skill.tools.map((tool) => (
                      <span key={tool}>{tool}</span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </aside>

      <main className="center-stage">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              <Activity size={15} />
              <span>Live agent workspace</span>
            </div>
            <h2>Agent Console</h2>
          </div>
          <div className="top-actions">
            <div className="metric-chip">
              <Clock3 size={15} />
              <span>{completedTasks} completed</span>
            </div>
            <div className="metric-chip">
              <Gauge size={15} />
              <span>{trace.length || 0} trace steps</span>
            </div>
          </div>
        </header>

        <section className="command-deck">
          {starterPrompts.map((prompt) => (
            <button key={prompt} onClick={() => setInput(prompt)}>
              <Play size={15} />
              <span>{prompt}</span>
            </button>
          ))}
        </section>

        <section className="conversation">
          {turns.length === 0 && (
            <div className="empty-state">
              <div className="empty-mark">
                <Bot size={38} />
              </div>
              <h3>启动一次可观察的 Agent Run</h3>
              <p>每次对话都会保留 ReAct 决策、工具调用和 observation，方便调试大型 Agent 行为。</p>
            </div>
          )}

          {turns.map((turn) => (
            <article className="turn" key={turn.id}>
              <div className="message user-message">
                <div className="avatar user-avatar">
                  <UserRound size={17} />
                </div>
                <div>
                  <span className="message-label">User</span>
                  <p>{turn.user}</p>
                  <FileReferenceCards message={turn.user} />
                </div>
              </div>

              <TodoCards events={turn.events ?? []} />

              {turn.error && (
                <div className="message error-message">
                  <div className="avatar error-avatar">
                    <CircleAlert size={17} />
                  </div>
                  <div>
                    <span className="message-label">Error</span>
                    <p>{turn.error}</p>
                  </div>
                </div>
              )}

              {turn.assistant && (
                <div className="message assistant-message">
                  <div className="avatar assistant-avatar">
                    <Bot size={17} />
                  </div>
                  <div>
                    <span className="message-label">ABC Agent</span>
                    <p>{turn.assistant}</p>
                    <ToolCards trace={turn.trace} events={turn.events} />
                    <ArtifactCards artifacts={extractArtifacts(turn.trace)} />
                  </div>
                </div>
              )}

              <RunTimeline trace={turn.trace} streaming={turn.streaming} />

              {turn.trace && turn.trace.length > 0 && (
                <div className="run-summary">
                  {turn.trace.map((step) => (
                    <button
                      key={step.step}
                      className={step.action === "tool" ? "trace-chip tool" : "trace-chip final"}
                      onClick={() => setSelectedTraceIndex(step.step - 1)}
                    >
                      {step.action === "tool" ? <Hammer size={14} /> : <CheckCircle2 size={14} />}
                      <span>Step {step.step}</span>
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}

          {loading && (
            <div className="loading-line">
              <Loader2 size={18} />
              <span>Agent 正在规划、调用工具并整理答案...</span>
            </div>
          )}
        </section>

        <form
          className={dragActive ? "composer drag-active" : "composer"}
          onSubmit={handleSubmit}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="composer-tools">
            <span>
              <ShieldCheck size={15} />
              Local secrets protected
            </span>
            <span>
              <Layers3 size={15} />
              Skill-aware ReAct
            </span>
            <span>
              <Upload size={15} />
              File-first tools
            </span>
          </div>
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            multiple
            accept=".json,.txt,.abc,.mid,.midi"
            onChange={(event) => {
              if (event.target.files) {
                handleFiles(event.target.files);
              }
              event.currentTarget.value = "";
            }}
          />
          <div className="drop-zone" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} />
            <span>拖入 ABC/JSON 文件，或点击选择文件；也可以直接复制文件或粘贴大段文本</span>
            {uploading && <Loader2 className="spin-icon" size={16} />}
          </div>
          {attachments.length > 0 && (
            <div className="attachment-list">
              {attachments.map((file) => (
                <div className="attachment" key={file.path}>
                  <FileText size={16} />
                  <div>
                    <strong>{file.filename}</strong>
                    <span>{formatBytes(file.size_bytes)} · {file.path}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`移除 ${file.filename}`}
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((item) => item.path !== file.path)
                      )
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="composer-row">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onPaste={handlePaste}
              placeholder="输入任务，例如：读取 sky-music-tools skill，并告诉我如何转 ABC"
              rows={3}
            />
            <button
              type="submit"
              disabled={loading || uploading || buildMessage(input.trim()).length === 0}
            >
              {loading || uploading ? <Loader2 size={18} /> : <Send size={18} />}
              <span>Run</span>
            </button>
          </div>
        </form>
      </main>

      <aside className="right-inspector">
        <section className="panel inspector-panel">
          <div className="panel-title">
            <span>Run inspector</span>
            <PanelRightOpen size={16} />
          </div>
          {selectedTrace ? (
            <div className="inspector-content">
              <div className="inspector-step">
                <div className="step-index">{selectedTrace.step}</div>
                <div>
                  <strong>{selectedTrace.action === "tool" ? "Tool action" : "Final answer"}</strong>
                  <p>{selectedTrace.thought || "No thought recorded."}</p>
                </div>
              </div>

              {selectedTrace.tool_call && (
                <>
                  <div className="tool-card">
                    <div className="tool-card-head">
                      <TerminalSquare size={16} />
                      <strong>{selectedTrace.tool_call.name}</strong>
                    </div>
                    <span className={selectedTrace.tool_call.ok ? "ok-badge" : "fail-badge"}>
                      {selectedTrace.tool_call.ok ? "completed" : "failed"}
                    </span>
                  </div>
                  <div className="code-block">
                    <div className="code-title">
                      <FileJson size={15} />
                      <span>Arguments</span>
                    </div>
                    <pre>{JSON.stringify(selectedTrace.tool_call.arguments, null, 2)}</pre>
                  </div>
                  <div className="code-block">
                    <div className="code-title">
                      <Code2 size={15} />
                      <span>Observation</span>
                    </div>
                    <pre>{formatObservation(selectedTrace.tool_call.observation)}</pre>
                  </div>
                </>
              )}

              {selectedTrace.final && (
                <div className="final-card">
                  <CheckCircle2 size={18} />
                  <p>{selectedTrace.final}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="inspector-empty">
              <History size={34} />
              <h3>No run selected</h3>
              <p>发送消息后，这里会显示 ReAct trace、工具参数和 observation。</p>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
