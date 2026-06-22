import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Hammer,
  Loader2,
  Play,
  RefreshCcw,
  Send,
  Sparkles,
  UserRound
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { checkHealth, fetchSkills, sendMessage } from "./api";
import type { ChatMessage, ConversationTurn, SkillInfo } from "./types";

const starterPrompts = [
  "列出当前可用 skills，并说明每个 skill 能做什么",
  "用 ReAct 解释一下你会如何处理一个 Sky 谱转 ABC 的任务",
  "你好，介绍一下 ABC Agent 当前具备的能力"
];

export function App() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [online, setOnline] = useState(false);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [input, setInput] = useState("");
  const [maxSteps, setMaxSteps] = useState(6);
  const [loading, setLoading] = useState(false);
  const [skillError, setSkillError] = useState("");

  const history = useMemo<ChatMessage[]>(() => {
    return turns.flatMap((turn) => {
      const messages: ChatMessage[] = [{ role: "user", content: turn.user }];
      if (turn.assistant) {
        messages.push({ role: "assistant", content: turn.assistant });
      }
      return messages;
    });
  }, [turns]);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    const id = crypto.randomUUID();
    setInput("");
    setLoading(true);
    setTurns((current) => [...current, { id, user: message }]);

    try {
      const response = await sendMessage(message, history, maxSteps);
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? { ...turn, assistant: response.answer, trace: response.trace }
            : turn
        )
      );
    } catch (error) {
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                error: error instanceof Error ? error.message : "请求失败"
              }
            : turn
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function usePrompt(prompt: string) {
    setInput(prompt);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h1>ABC Agent</h1>
            <p>ReAct + Skill Tools</p>
          </div>
        </div>

        <section className="runtime">
          <div className="section-title">
            <span>运行状态</span>
            <button className="icon-button" onClick={refreshRuntime} aria-label="刷新">
              <RefreshCcw size={16} />
            </button>
          </div>
          <div className={online ? "status online" : "status offline"}>
            {online ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
            <span>{online ? "Backend online" : "Backend offline"}</span>
          </div>
          <label className="range-label">
            <span>ReAct steps</span>
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

        <section className="skills-panel">
          <div className="section-title">
            <span>Skills</span>
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

      <main className="workspace">
        <header className="topbar">
          <div>
            <h2>Agent Console</h2>
            <p>直接对话，观察 ReAct 推理、工具选择和 skill 调用结果。</p>
          </div>
        </header>

        <section className="prompt-strip">
          {starterPrompts.map((prompt) => (
            <button key={prompt} onClick={() => usePrompt(prompt)}>
              <Play size={15} />
              <span>{prompt}</span>
            </button>
          ))}
        </section>

        <section className="conversation">
          {turns.length === 0 && (
            <div className="empty-state">
              <Bot size={42} />
              <h3>开始一次 ReAct 对话</h3>
              <p>Agent 会先判断是否需要 skill，再调用工具，最后给出答案。</p>
            </div>
          )}

          {turns.map((turn) => (
            <article className="turn" key={turn.id}>
              <div className="message user-message">
                <UserRound size={18} />
                <p>{turn.user}</p>
              </div>

              {turn.error && (
                <div className="message error-message">
                  <CircleAlert size={18} />
                  <p>{turn.error}</p>
                </div>
              )}

              {turn.assistant && (
                <div className="message assistant-message">
                  <Bot size={18} />
                  <p>{turn.assistant}</p>
                </div>
              )}

              {turn.trace && turn.trace.length > 0 && (
                <div className="trace-list">
                  {turn.trace.map((step) => (
                    <details key={step.step} open={step.action === "tool"}>
                      <summary>
                        <span>Step {step.step}</span>
                        <strong>{step.action === "tool" ? "Tool" : "Final"}</strong>
                      </summary>
                      {step.thought && <p className="thought">{step.thought}</p>}
                      {step.tool_call && (
                        <div className="tool-call">
                          <div className="tool-name">
                            <Hammer size={15} />
                            <span>{step.tool_call.name}</span>
                          </div>
                          <pre>
                            {JSON.stringify(
                              {
                                arguments: step.tool_call.arguments,
                                observation: step.tool_call.observation
                              },
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      )}
                      {step.final && <p className="final-text">{step.final}</p>}
                    </details>
                  ))}
                </div>
              )}
            </article>
          ))}

          {loading && (
            <div className="loading-line">
              <Loader2 size={18} />
              <span>Agent 正在推理...</span>
            </div>
          )}
        </section>

        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入任务，例如：读取 sky-music-tools skill，并告诉我如何转 ABC"
            rows={3}
          />
          <button type="submit" disabled={loading || input.trim().length === 0}>
            {loading ? <Loader2 size={18} /> : <Send size={18} />}
            <span>发送</span>
          </button>
        </form>
      </main>
    </div>
  );
}
