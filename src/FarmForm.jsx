import React, { useState } from "react";

export default function FarmForm({ onSubmit, initialData }) {
  const [formData, setFormData] = useState(
    initialData || {
      location: "",
      crop: "",
      farmSize: "",
      temperature: "",
      waterAvailability: "Adequate",
      soilType: "Loamy / Alluvial",
      lastIrrigated: "",
      observedIssues: "",
      detailedNotes: "",
    }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePreFill = (preset) => {
    if (preset === "drought") {
      setFormData({
        location: "Jodhpur, Rajasthan",
        crop: "Wheat & Mustard",
        farmSize: "4 acres",
        temperature: "43°C (Severe heatwave)",
        waterAvailability: "Scare / Depleted groundwater",
        soilType: "Sandy / Arid",
        lastIrrigated: "12 days ago",
        observedIssues: "Cracked soil, leaves drying, brown curling edges, locust activity noticed nearby",
        detailedNotes: "Crucial grain filling stage. Looking for emergency survival advice and risk warnings.",
      });
    } else if (preset === "rain") {
      setFormData({
        location: "Alappuzha, Kerala",
        crop: "Paddy (Rice)",
        farmSize: "3 acres",
        temperature: "29°C (Continuous monsoon overcast)",
        waterAvailability: "Excess / Flooded canals",
        soilType: "Clayey / Waterlogged",
        lastIrrigated: "Continuous heavy rain for 10 days",
        observedIssues: "Submerged root zones, water stagnation, leaf yellowing, suspect bacterial blight",
        detailedNotes: "Field drainage is slow, need urgent steps to minimize fungal rot and protect current yield.",
      });
    } else if (preset === "pest") {
      setFormData({
        location: "Kolar, Karnataka",
        crop: "Tomato",
        farmSize: "2.5 acres",
        temperature: "31°C (Warm and humid)",
        waterAvailability: "Moderate (Drip available)",
        soilType: "Red Sandy Loam",
        lastIrrigated: "2 days ago",
        observedIssues: "Whiteflies on undersides of leaves, curling leaf tops, scattered yellow stippling",
        detailedNotes: "Drip irrigation functioning well, flowering has begun. Need safe pest control & nutrition schedule.",
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.location.trim() || !formData.crop.trim()) {
      alert("Please provide at least your farm location and the crop being cultivated.");
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="form-page">
      {/* Hero / Project Overview Header */}
      <div className="project-banner">
        <div className="badge-tag">🌾 Next-Gen Agricultural Intelligence</div>
        <h2 className="project-title">Farm Diagnostics & Advisory Intake</h2>
        <p className="project-intro">
          The <strong>Agricultural Advisory Control Room</strong> uses an agentic <strong>Blackboard Architecture</strong>. 
          Once you submit your farm details, individual AI specialists (Soil & Crop, Irrigation, Pest & Pathogens, and Weather Risk) 
          inspect your farm telemetry, independently post structured findings to a shared blackboard, and an 
          <strong>Advisor Coordinator</strong> synthesizes the combined intelligence into a clear, prioritized action plan.
        </p>

        {/* Quick sample buttons */}
        <div className="sample-presets">
          <span>Try quick sample scenario:</span>
          <button type="button" className="btn-chip" onClick={() => handlePreFill("drought")}>
            🔥 Heatwave & Drought
          </button>
          <button type="button" className="btn-chip" onClick={() => handlePreFill("rain")}>
            🌧️ Waterlogging & Rot
          </button>
          <button type="button" className="btn-chip" onClick={() => handlePreFill("pest")}>
            🐛 Tomato Whitefly Outbreak
          </button>
        </div>
      </div>

      {/* Main Form Card */}
      <form onSubmit={handleSubmit} className="farmer-form-card">
        <div className="form-grid">
          <div className="form-group">
            <label>📍 Farm Location & Region <span className="req">*</span></label>
            <input
              type="text"
              name="location"
              required
              placeholder="e.g. Nashik, Maharashtra or Guntur, AP"
              value={formData.location}
              onChange={handleChange}
            />
            <span className="field-hint">Used for localized climate and agro-climatic zone analysis</span>
          </div>

          <div className="form-group">
            <label>🌱 Crop Being Cultivated <span className="req">*</span></label>
            <input
              type="text"
              name="crop"
              required
              placeholder="e.g. Wheat, Basmati Rice, Cotton, Chilli"
              value={formData.crop}
              onChange={handleChange}
            />
            <span className="field-hint">Specify primary crop & variety if known</span>
          </div>

          <div className="form-group">
            <label>📏 Farm Size / Land Area</label>
            <input
              type="text"
              name="farmSize"
              placeholder="e.g. 3.5 Acres / 2 Hectares"
              value={formData.farmSize}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>🌡️ Current Temperature & Weather</label>
            <input
              type="text"
              name="temperature"
              placeholder="e.g. 38°C dry & sunny / 24°C heavy rain"
              value={formData.temperature}
              onChange={handleChange}
            />
            <span className="field-hint">Ambient temperature or recent weather pattern</span>
          </div>

          <div className="form-group">
            <label>💧 Water & Irrigation Availability</label>
            <select
              name="waterAvailability"
              value={formData.waterAvailability}
              onChange={handleChange}
            >
              <option value="Abundant / Canal Flow">Abundant / Canal Flow</option>
              <option value="Adequate / Borewell & Drip">Adequate / Borewell & Drip</option>
              <option value="Moderate / Limited Schedule">Moderate / Limited Schedule</option>
              <option value="Scarce / Severe Water Stress">Scarce / Severe Water Stress</option>
              <option value="Excess / Waterlogged / Flooded">Excess / Waterlogged / Flooded</option>
            </select>
          </div>

          <div className="form-group">
            <label>⏳ Last Irrigated / Rain Event</label>
            <input
              type="text"
              name="lastIrrigated"
              placeholder="e.g. 8 days ago / Raining continuously"
              value={formData.lastIrrigated}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>🪨 Soil Type & Condition</label>
            <input
              type="text"
              name="soilType"
              placeholder="e.g. Black cotton, Loamy, Red sandy, Clayey"
              value={formData.soilType}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>⚠️ Observed Symptoms or Pests</label>
            <input
              type="text"
              name="observedIssues"
              placeholder="e.g. Leaves turning yellow, wilting stems, tiny aphids"
              value={formData.observedIssues}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group full-width">
          <label>📝 Detailed Farm Description & Concerns</label>
          <textarea
            name="detailedNotes"
            rows="3"
            placeholder="Describe any other conditions: fertilizer history, flowering stage, soil salinity, sudden weather alerts, or specific questions for the advisory board..."
            value={formData.detailedNotes}
            onChange={handleChange}
          ></textarea>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-submit-farm">
            <span>🚀</span> Get Advisory & Launch Control Room
          </button>
        </div>
      </form>
    </div>
  );
}
