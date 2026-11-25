import React, { useState, useRef, useEffect } from "react";
import FarmForm from "./FarmForm";
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

  // Current View: "form" | "control-room"
  const [currentView, setCurrentView] = useState("form");
  const [farmDetails, setFarmDetails] = useState(null);

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

  const runAdvisoryPipeline = async (farmData) => {
    const activeKey = apiKey || localStorage.getItem("gemini_key") || ENV_KEY;
    if (!activeKey) {
      alert("Please provide a Gemini API Key in the top right to start the advisory board.");
      return;
    }

    setRunning(true);
    setBlackboard([]);
    setRiskData(null);
    setFinalAdvisory("");
    setLog([]);
    setAgentStatus({ soil: "idle", water: "idle", pest: "idle", risk: "idle", coord: "idle" });

    // Format farmer inputs into structured telemetry prompt
    const farmerTelemetry = `
=== FARM TELEMETRY & FIELD INTAKE ===
• Location: ${farmData.location || "Unspecified"}
• Cultivating Crop: ${farmData.crop || "Unspecified"}
• Land / Area: ${farmData.farmSize || "Not specified"}
• Temperature / Climate: ${farmData.temperature || "Not specified"}
• Water Availability: ${farmData.waterAvailability || "Not specified"}
• Last Irrigation / Rain: ${farmData.lastIrrigated || "Not specified"}
• Soil Characteristics: ${farmData.soilType || "Not specified"}
• Observed Symptoms / Pests: ${farmData.observedIssues || "None reported"}
• Detailed Farm Context: ${farmData.detailedNotes || "None"}
=====================================`;

    const board = [];

    try {
      /* ── Step 1: Soil & Crop Agent ── */
      addLog("🌱 Soil & Crop Specialist reading telemetry...");
      setStatus("soil", "running");
      const soilResult = await soilCropAgent(activeKey, farmerTelemetry);
      board.push(soilResult);
      setBlackboard([...board]);
      setStatus("soil", "done");
      addLog("✅ Soil & Crop Specialist posted to blackboard.");

      /* ── Step 2: Water Agent ── */
      addLog("💧 Water & Irrigation Specialist assessing board...");
      setStatus("water", "running");
      const waterResult = await waterAgent(activeKey, farmerTelemetry, board);
      board.push(waterResult);
      setBlackboard([...board]);
      setStatus("water", "done");
      addLog("✅ Water Specialist posted to blackboard.");

      /* ── Step 3: Pest Agent ── */
      addLog("🐛 Pest & Disease Specialist scanning risks...");
      setStatus("pest", "running");
      const pestResult = await pestAgent(activeKey, farmerTelemetry, board);
      board.push(pestResult);
      setBlackboard([...board]);
      setStatus("pest", "done");
      addLog("✅ Pest Specialist posted to blackboard.");

      /* ── Step 4: Risk Alert Agent ── */
      addLog("⚠️ Risk Alert Agent scanning environmental hazards...");
      setStatus("risk", "running");
      const riskResult = await riskAlertAgent(activeKey, farmerTelemetry, board);
      setRiskData(riskResult);
      board.push(riskResult);
      setBlackboard([...board]);
      setStatus("risk", "done");
      if (riskResult.urgent) {
        addLog(`🚨 URGENT RISK ALERT DETECTED [${riskResult.hazardType || "Hazard"}]`);
      } else {
        addLog("✅ Risk Alert: No extreme climatic hazards detected.");
      }

      /* ── Step 5: Coordinator ── */
      addLog("🧠 Advisor Coordinator compiling unified advisory...");
      setStatus("coord", "running");
      const advisory = await coordinatorAgent(activeKey, farmerTelemetry, board, riskResult);
      setFinalAdvisory(advisory);
      setStatus("coord", "done");
      addLog("🎉 Comprehensive advisory synthesized successfully!");
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
      console.error(err);
    }

    setRunning(false);
  };

  const handleFormSubmit = (data) => {
    setFarmDetails(data);
    setCurrentView("control-room");
    runAdvisoryPipeline(data);
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
          <div className="logo" onClick={() => setCurrentView("form")} style={{ cursor: "pointer" }}>
            <span className="logo-icon">🌾</span>
            <div>
              <h1>Agricultural Advisory Control Room</h1>
              <p>Blackboard Multi-Agent System powered by Gemini AI</p>
            </div>
          </div>

          <div className="header-nav">
            <button
              className={`nav-tab-btn ${currentView === "form" ? "active" : ""}`}
              onClick={() => setCurrentView("form")}
            >
              📝 Farm Intake Form
            </button>
            <button
              className={`nav-tab-btn ${currentView === "control-room" ? "active" : ""}`}
              onClick={() => setCurrentView("control-room")}
            >
              📊 Advisory Control Room
              {running && <span className="running-badge-mini">Live</span>}
            </button>
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
        {currentView === "form" ? (
          <FarmForm onSubmit={handleFormSubmit} initialData={farmDetails} />
        ) : (
          <div className="control-room-view">
            {/* Farm Profile Header Summary */}
            {farmDetails && (
              <div className="farm-summary-bar">
                <div className="summary-col">
                  <span className="summary-label">Farm Location</span>
                  <strong className="summary-val">📍 {farmDetails.location}</strong>
                </div>
                <div className="summary-col">
                  <span className="summary-label">Cultivating</span>
                  <strong className="summary-val">🌱 {farmDetails.crop} ({farmDetails.farmSize || "Size N/A"})</strong>
                </div>
                <div className="summary-col">
                  <span className="summary-label">Weather / Temp</span>
                  <strong className="summary-val">🌡️ {farmDetails.temperature || "Normal"}</strong>
                </div>
                <div className="summary-col">
                  <span className="summary-label">Water Status</span>
                  <strong className="summary-val">💧 {farmDetails.waterAvailability}</strong>
                </div>
                <div className="summary-actions">
                  <button
                    className="btn-edit-farm"
                    onClick={() => setCurrentView("form")}
                  >
                    ✏️ Edit Farm Details
                  </button>
                  <button
                    className="btn-re-run"
                    disabled={running}
                    onClick={() => runAdvisoryPipeline(farmDetails)}
                  >
                    🔄 Re-run Advisory
                  </button>
                </div>
              </div>
            )}

            <div className="columns">
              {/* ── Left: Specialist Agents + Log ── */}
              <div className="left-col">
                <div className="panel">
                  <h2 className="panel-title">🤖 Specialist Agents</h2>
                  <p className="panel-sub">Each specialist reads farm telemetry & blackboard records, then posts structured diagnosis.</p>
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
                  <h2 className="panel-title">📡 Blackboard Activity Log</h2>
                  <div className="log-box" ref={logRef}>
                    {log.length === 0 ? (
                      <p className="log-empty">Waiting to initiate blackboard cycle...</p>
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
                      <span>URGENT RISK ALERT: {riskData.hazardType || "Harmful Condition"}</span>
                    </div>
                    <p className="risk-warning">{riskData.warning}</p>
                    {riskData.immediateAction && (
                      <p className="risk-action"><strong>Emergency Action:</strong> {riskData.immediateAction}</p>
                    )}
                  </div>
                )}

                {/* Blackboard */}
                <div className="panel">
                  <h2 className="panel-title">📋 Shared Advisory Blackboard</h2>
                  <p className="panel-sub">Central structured data board shared among all specialist agents.</p>
                  {blackboard.length === 0 ? (
                    <div className="empty-state">
                      <span className="empty-icon">📋</span>
                      <p>No specialist postings yet. Submit the farm form to populate the blackboard.</p>
                    </div>
                  ) : (
                    <div className="blackboard">
                      {blackboard.map((entry, i) => (
                        <div key={i} className="bb-entry">
                          <div className="bb-agent-name">
                            {agentIcon(entry.agent)} {entry.agent}
                            {entry.urgent !== undefined && (
                              <span className={`bb-badge ${entry.urgent ? "urgent" : "safe"}`}>
                                {entry.urgent ? "🚨 URGENT RISK" : "✅ Safe Conditions"}
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
                    <h2 className="panel-title">🧠 Plain-Language Farm Advisory</h2>
                    <p className="panel-sub">Synthesized by the Advisor Coordinator from all specialist blackboard evaluations.</p>
                    <div className="advisory-content">
                      {finalAdvisory.split("\n").filter(Boolean).map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* How it works info if idle */}
                {!running && blackboard.length === 0 && (
                  <div className="panel how-panel">
                    <h2 className="panel-title">🏗️ Blackboard Architecture Lifecycle</h2>
                    <div className="arch-flow">
                      <div className="arch-step">
                        <span className="arch-num">1</span>
                        <div>
                          <strong>Farmer Telemetry</strong>
                          <p>Location, crop, weather, soil, and water stress factors from the Intake Form.</p>
                        </div>
                      </div>
                      <div className="arch-arrow">↓</div>
                      <div className="arch-step">
                        <span className="arch-num">2</span>
                        <div>
                          <strong>Specialist Analysis & Shared Board</strong>
                          <p>Soil, Water, and Pest agents iteratively post structured findings to the shared blackboard.</p>
                        </div>
                      </div>
                      <div className="arch-arrow">↓</div>
                      <div className="arch-step">
                        <span className="arch-num">3</span>
                        <div>
                          <strong>Risk Alert Interceptor</strong>
                          <p>Flags immediate hazards (heatwave, frost, rot) and prepends urgent warnings.</p>
                        </div>
                      </div>
                      <div className="arch-arrow">↓</div>
                      <div className="arch-step">
                        <span className="arch-num">4</span>
                        <div>
                          <strong>Advisor Coordinator</strong>
                          <p>Synthesizes comprehensive, farmer-friendly guidance in natural language.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
