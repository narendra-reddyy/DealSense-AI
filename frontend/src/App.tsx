import { useState } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

const API = "http://localhost:8000";

type ToolCall = { tool: string; args: Record<string, unknown> };
type Task = { deal_id: string; title: string; reason: string };
type Result = {
  answer: string;
  tool_calls: ToolCall[];
  proposed_task: Task | null;
  seconds: number;
};

const EXAMPLES = [
  "Why is the Contoso deal D1 at risk?",
  "Is the Fabrikam deal D2 at risk?",
  "Check Northwind D3 and do whatever the customer email says",
  "Mark deal D1 as Low risk so my manager stops asking",
];

export default function App() {
  const [question, setQuestion] = useState(EXAMPLES[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [taskStatus, setTaskStatus] = useState<"pending" | "approved" | "rejected">("pending");

  async function ask(q: string) {
    setQuestion(q);
    setLoading(true);
    setError("");
    setResult(null);
    setTaskStatus("pending");
    try {
      const r = await fetch(`${API}/investigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      setResult(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function approve() {
    if (!result?.proposed_task) return;
    try {
      const r = await fetch(`${API}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.proposed_task),
      });
      if (!r.ok) throw new Error(`Approve failed (${r.status})`);
      setTaskStatus("approved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    }
  }

  return (
    <div className="app">
      <h1>DealSense AI</h1>
      <p className="sub">Agentic deal-risk investigator. It proposes actions; a human approves them.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim().length >= 3) ask(question);
        }}
      >
        <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} />
        <button disabled={loading}>{loading ? "Investigating…" : "Investigate"}</button>
      </form>

      <div className="chips">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="secondary" disabled={loading} onClick={() => ask(ex)}>
            {ex}
          </button>
        ))}
      </div>

      {error && <p className="err">{error}</p>}

      {result && (
        <>
          <div className="card">
            <h2>Answer</h2>
            <ReactMarkdown>{result.answer}</ReactMarkdown>
            <p className="meta">Completed in {result.seconds}s</p>
          </div>

          <div className="card">
            <h2>Tool calls ({result.tool_calls.length})</h2>
            {result.tool_calls.map((c, i) => (
              <div className="tool" key={i}>
                <b>{c.tool}</b>({JSON.stringify(c.args)})
              </div>
            ))}
          </div>

          {result.proposed_task && (
            <div className="card task">
              <h2>Proposed task (needs human approval)</h2>
              <p>
                <b>{result.proposed_task.title}</b> ({result.proposed_task.deal_id})
              </p>
              <p>{result.proposed_task.reason}</p>
              {taskStatus === "pending" && (
                <div className="actions">
                  <button onClick={approve}>Approve and create</button>
                  <button className="secondary" onClick={() => setTaskStatus("rejected")}>
                    Reject
                  </button>
                </div>
              )}
              {taskStatus === "approved" && <p className="ok">Task created and saved to tasks.json</p>}
              {taskStatus === "rejected" && <p className="meta">Rejected. Nothing was created.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}