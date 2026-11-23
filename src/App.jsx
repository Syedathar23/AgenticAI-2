import React, { useState, useRef, useEffect } from "react";
import {
  soilCropAgent,
  waterAgent,
  pestAgent,
  riskAlertAgent,
  coordinatorAgent,
} from "./agents";
import "./App.css";

/* ── Small helper components ─────────────────────────── */
const StatusDot = ({ status }) => {
  const cls =
    status === "done"
      ? "dot done"
      : status === "running"
      ? "dot running"
      : status === "error"
      ? "dot error"
      : "dot idle";
  return <span className={cls} />;
};

const AgentCard = ({ icon, name, color, status, data }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`agent-card ${color}`}>
      <div className="agent-header" onClick={() => data && setOpen((o) => !o)}>
        <span className="agent-icon">{icon}</span>
        <span className="agent-name">{name}</span>
        <StatusDot status={status} />
        {data && (
          <span className="toggle-arrow">{open ? "▲" : "▼"}</span>
        )}
      </div>
      {open && data && (
        <div className="agent-body">
          {Object.entries(data)
            .filter(([k]) => k !== "agent" && k !== "parseError" && k !== "raw")
            .map(([k, v]) => (
              <div key={k} className="agent-field">
                <span className="field-key">{camel(k)}</span>
                <span className="field-val">
                  {Array.isArray(v) ? v.join(", ") : String(v)}
                </span>
              </div>
            ))}
          {data.parseError && (
            <div className="agent-field">
              <span className="field-key">Raw</span>
              <span className="field-val">{data.raw}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const camel = (s) =>
  s
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());

/* ── Main App ─────────────────────────────────────────── */
export default function App() {
  const ENV_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("gemini_key") || ENV_KEY
  );
  const [keyInput, setKeyInput] = useState("");
  const [keySet, setKeySet] = useState(() => !!(localStorage.getItem("gemini_key") || ENV_KEY));
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [blackboard, setBlackboard] = useState([]);
  const [riskData, setRiskData] = useState(null);
  const [finalAdvisory, setFinalAdvisory] = useState("");
  const [agentStatus, setAgentStatus] = useState({
    soil: "idle",
    water: "idle",
    pest: "idle",
    risk: "idle",
    coord: "idle",
  });
  const [log, setLog] = useState([]);
  const logRef = useRef(null);

  const addLog = (msg) =>
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);

  useEffect(() => {
    if (logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const saveKey = () => {
    if (!keyInput.trim()) return;
    localStorage.setItem("gemini_key", keyInput.trim());
    setApiKey(keyInput.trim());
    setKeySet(true);
    setKeyInput("");
  };

  const setStatus = (agent, status) =>
    setAgentStatus((prev) => ({ ...prev, [agent]: status }));

  const run = async () => {
    if (!query.trim() || !apiKey) return;
    setRunning(true);
    setBlackboard([]);
    setRiskData(null);
    setFinalAdvisory("");
    setLog([]);
    setAgentStatus({ soil: "idle", water: "idle", pest: "idle", risk: "idle", coord: "idle" });

    const board = [];

    try {
      /* ── Step 1: Soil & Crop Agent ── */
      addLog("🌱 Soil & Crop Specialist analyzing...");
      setStatus("soil", "running");
      const soilResult = await soilCropAgent(apiKey, query);
      board.push(soilResult);
      setBlackboard([...board]);
      setStatus("soil", "done");
      addLog("✅ Soil & Crop Specialist wrote to blackboard.");

      /* ── Step 2: Water Agent ── */
      addLog("💧 Water & Irrigation Specialist analyzing...");
      setStatus("water", "running");
      const waterResult = await waterAgent(apiKey, query, board);
      board.push(waterResult);
      setBlackboard([...board]);
      setStatus("water", "done");
      addLog("✅ Water Specialist wrote to blackboard.");

      /* ── Step 3: Pest Agent ── */
      addLog("🐛 Pest & Disease Specialist analyzing...");
      setStatus("pest", "running");
      const pestResult = await pestAgent(apiKey, query, board);
      board.push(pestResult);
      setBlackboard([...board]);
      setStatus("pest", "done");
      addLog("✅ Pest Specialist wrote to blackboard.");

      /* ── Step 4: Risk Alert Agent ── */
      addLog("⚠️ Risk Alert Agent scanning for hazards...");
      setStatus("risk", "running");
      const riskResult = await riskAlertAgent(apiKey, query, board);
      setRiskData(riskResult);
      board.push(riskResult);
      setBlackboard([...board]);
      setStatus("risk", "done");
      if (riskResult.urgent) {
        addLog("🚨 URGENT RISK DETECTED — alert placed on board!");
      } else {
        addLog("✅ Risk Alert: No urgent hazards found.");
      }

      /* ── Step 5: Coordinator ── */
      addLog("🧠 Advisor Coordinator compiling final advisory...");
      setStatus("coord", "running");
      const advisory = await coordinatorAgent(apiKey, query, board, riskResult);
      setFinalAdvisory(advisory);
      setStatus("coord", "done");
      addLog("🎉 Final advisory ready for the farmer!");
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
      console.error(err);
    }

    setRunning(false);
  };

  const agents = [
    { key: "soil", icon: "🌱", name: "Soil & Crop Specialist", color: "green", data: blackboard.find((b) => b.agent === "Soil & Crop Specialist") },
    { key: "water", icon: "💧", name: "Water & Irrigation Specialist", color: "sky", data: blackboard.find((b) => b.agent === "Water & Irrigation Specialist") },
    { key: "pest", icon: "🐛", name: "Pest & Disease Specialist", color: "orange", data: blackboard.find((b) => b.agent === "Pest & Disease Specialist") },
    { key: "risk", icon: "⚠️", name: "Risk Alert Agent", color: "red", data: blackboard.find((b) => b.agent === "Risk Alert") },
    { key: "coord", icon: "🧠", name: "Advisor Coordinator", color: "purple", data: null },
  ];

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🌾</span>
            <div>
              <h1>Agricultural Advisory Control Room</h1>
              <p>Blackboard Multi-Agent System powered by Gemini AI</p>
            </div>
          </div>
          {!keySet ? (
            <div className="key-box">
              <input
                type="password"
                placeholder="Enter Gemini API Key..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveKey()}
              />
              <button onClick={saveKey} className="btn-green">Save Key</button>
            </div>
          ) : (
            <div className="key-set">
              <span>🔑 API Key set</span>
              <button
                className="btn-outline"
                onClick={() => { localStorage.removeItem("gemini_key"); setApiKey(""); setKeySet(false); }}
              >
                Change
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main">
        {/* ── Input Panel ── */}
        <section className="input-section">
          <label className="input-label">📋 Describe your farming situation</label>
          <textarea
            className="input-textarea"
            rows={4}
            placeholder="e.g. I have 5 acres of wheat in Rajasthan. It's very hot and dry lately, and I noticed some yellowing leaves and tiny insects on the plants. I last watered 10 days ago..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={running}
          />
          <button
            className={`btn-run ${running ? "loading" : ""}`}
            onClick={run}
            disabled={running || !query.trim() || !keySet}
          >
            {running ? (
              <><span className="spinner" /> Agents Working...</>
            ) : (
              <><span>🚀</span> Get Advisory</>
            )}
          </button>
        </section>

        <div className="columns">
          {/* ── Left: Agents + Log ── */}
          <div className="left-col">
            <div className="panel">
              <h2 className="panel-title">🤖 Specialist Agents</h2>
              <p className="panel-sub">Each agent reads the farmer input and/or the shared blackboard, then writes its findings.</p>
              <div className="agents-list">
                {agents.map((a) => (
                  <AgentCard
                    key={a.key}
                    icon={a.icon}
                    name={a.name}
                    color={a.color}
                    status={agentStatus[a.key]}
                    data={a.data}
                  />
                ))}
              </div>
            </div>

            {/* Activity Log */}
            <div className="panel log-panel">
              <h2 className="panel-title">📡 Activity Log</h2>
              <div className="log-box" ref={logRef}>
                {log.length === 0 ? (
                  <p className="log-empty">Waiting for farmer query...</p>
                ) : (
                  log.map((l, i) => <div key={i} className="log-line">{l}</div>)
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Blackboard + Advisory ── */}
          <div className="right-col">
            {/* Risk Alert Banner */}
            {riskData?.urgent && (
              <div className="risk-banner">
                <div className="risk-banner-title">
                  <span>🚨</span>
                  <span>URGENT RISK ALERT — {riskData.hazardType}</span>
                </div>
                <p className="risk-warning">{riskData.warning}</p>
                <p className="risk-action"><strong>Act Now:</strong> {riskData.immediateAction}</p>
              </div>
            )}

            {/* Blackboard */}
            <div className="panel">
              <h2 className="panel-title">📋 Shared Blackboard</h2>
              <p className="panel-sub">All agent findings are written here and read by subsequent agents.</p>
              {blackboard.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📋</span>
                  <p>Blackboard is empty. Submit a query to start.</p>
                </div>
              ) : (
                <div className="blackboard">
                  {blackboard.map((entry, i) => (
                    <div key={i} className="bb-entry">
                      <div className="bb-agent-name">
                        {agentIcon(entry.agent)} {entry.agent}
                        {entry.urgent !== undefined && (
                          <span className={`bb-badge ${entry.urgent ? "urgent" : "safe"}`}>
                            {entry.urgent ? "🚨 URGENT" : "✅ Safe"}
                          </span>
                        )}
                      </div>
                      {Object.entries(entry)
                        .filter(([k]) => !["agent", "parseError", "raw"].includes(k))
                        .map(([k, v]) => (
                          <div key={k} className="bb-row">
                            <span className="bb-key">{camel(k)}:</span>
                            <span className="bb-val">
                              {Array.isArray(v) ? v.join(", ") : String(v)}
                            </span>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Final Advisory */}
            {finalAdvisory && (
              <div className="panel advisory-panel">
                <h2 className="panel-title">🧠 Final Advisory</h2>
                <p className="panel-sub">Compiled by the Advisor Coordinator from all specialist findings.</p>
                <div className="advisory-content">
                  {finalAdvisory.split("\n").filter(Boolean).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>
            )}

            {/* How it works */}
            {!running && blackboard.length === 0 && (
              <div className="panel how-panel">
                <h2 className="panel-title">🏗️ Blackboard Architecture</h2>
                <div className="arch-flow">
                  <div className="arch-step">
                    <span className="arch-num">1</span>
                    <div>
                      <strong>Farmer Input</strong>
                      <p>You describe your crop, weather, and problems.</p>
                    </div>
                  </div>
                  <div className="arch-arrow">↓</div>
                  <div className="arch-step">
                    <span className="arch-num">2</span>
                    <div>
                      <strong>Specialist Agents</strong>
                      <p>Soil, Water, and Pest agents each read and write to the shared blackboard.</p>
                    </div>
                  </div>
                  <div className="arch-arrow">↓</div>
                  <div className="arch-step">
                    <span className="arch-num">3</span>
                    <div>
                      <strong>Risk Alert Agent</strong>
                      <p>Scans all findings for urgent weather or hazard warnings.</p>
                    </div>
                  </div>
                  <div className="arch-arrow">↓</div>
                  <div className="arch-step">
                    <span className="arch-num">4</span>
                    <div>
                      <strong>Advisor Coordinator</strong>
                      <p>Reads the full blackboard and synthesizes a single plain-language advisory.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>🌾 Agricultural Advisory Control Room · Blackboard Multi-Agent System · Powered by Gemini AI</p>
      </footer>
    </div>
  );
}

function agentIcon(agent) {
  if (agent?.includes("Soil")) return "🌱";
  if (agent?.includes("Water")) return "💧";
  if (agent?.includes("Pest")) return "🐛";
  if (agent?.includes("Risk")) return "⚠️";
  if (agent?.includes("Coord")) return "🧠";
  return "🤖";
}
