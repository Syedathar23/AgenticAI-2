// agents.js — Blackboard Architecture Agents using Gemini AI
// Each agent reads farmer context + blackboard, writes its result to the board.

import { GoogleGenerativeAI } from "@google/generative-ai";

const getGenAI = (apiKey) => new GoogleGenerativeAI(apiKey);

// Models ordered by free-tier RPM (highest first)
const MODELS = ["gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-2.5-flash"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Extract retryDelay seconds from a 429 error message
const getRetryMs = (msg) => {
  const match = msg?.match(/retry[^\d]*(\d+(\.\d+)?)s/i);
  return match ? Math.ceil(parseFloat(match[1])) * 1000 + 500 : 12000;
};

const callGemini = async (apiKey, systemPrompt, userPrompt) => {
  const genAI = getGenAI(apiKey);

  for (let modelIdx = 0; modelIdx < MODELS.length; modelIdx++) {
    const modelName = MODELS[modelIdx];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(userPrompt);
        return result.response.text();
      } catch (err) {
        const msg = err.message || "";
        const is429 = msg.includes("429") || msg.includes("quota") || msg.includes("exceeded");
        const is503 = msg.includes("503") || msg.includes("high demand");
        const is404 = msg.includes("404") || msg.includes("not found") || msg.includes("no longer available");
        if (is404) break; // try next model
        if ((is429 || is503) && attempt < 3) {
          const wait = is429 ? getRetryMs(msg) : 2000 * attempt;
          await sleep(wait);
          continue;
        }
        if (attempt === 3) break; // try next model
        throw err;
      }
    }
  }
  throw new Error("All models are busy. Please wait 15 seconds and try again.");
};

// ── Agent 1: Soil & Crop Specialist ─────────────────────────────────────────
export const soilCropAgent = async (apiKey, farmerInput) => {
  const system = `You are a Soil & Crop Specialist agent in an Agricultural Advisory Control Room.
Your job: analyze the farmer's situation and provide structured soil and crop advice.
Respond ONLY in this JSON format (no markdown fences):
{
  "agent": "Soil & Crop Specialist",
  "soilHealth": "<1-2 sentences about soil condition>",
  "recommendedCrops": ["crop1", "crop2", "crop3"],
  "cropTips": "<2-3 sentences about best practices for the crops>",
  "keyAction": "<one clear immediate action>"
}`;

  const user = `Farmer's situation: ${farmerInput}`;
  const raw = await callGemini(apiKey, system, user);
  try {
    return JSON.parse(raw.trim());
  } catch {
    return { agent: "Soil & Crop Specialist", raw, parseError: true };
  }
};

// ── Agent 2: Water & Irrigation Specialist ───────────────────────────────────
export const waterAgent = async (apiKey, farmerInput, blackboard) => {
  const system = `You are a Water & Irrigation Specialist agent in an Agricultural Advisory Control Room.
You have access to the blackboard with earlier specialist findings.
Provide structured water management advice.
Respond ONLY in this JSON format (no markdown fences):
{
  "agent": "Water & Irrigation Specialist",
  "waterNeed": "<assessment of irrigation needs>",
  "schedule": "<suggested watering schedule>",
  "conservationTip": "<one water conservation tip>",
  "keyAction": "<one clear immediate action>"
}`;

  const user = `Farmer's situation: ${farmerInput}
Blackboard so far: ${JSON.stringify(blackboard)}`;
  const raw = await callGemini(apiKey, system, user);
  try {
    return JSON.parse(raw.trim());
  } catch {
    return { agent: "Water & Irrigation Specialist", raw, parseError: true };
  }
};

// ── Agent 3: Pest & Disease Specialist ───────────────────────────────────────
export const pestAgent = async (apiKey, farmerInput, blackboard) => {
  const system = `You are a Pest & Disease Specialist agent in an Agricultural Advisory Control Room.
Analyze risks based on the farmer's input and blackboard findings.
Respond ONLY in this JSON format (no markdown fences):
{
  "agent": "Pest & Disease Specialist",
  "riskLevel": "Low|Medium|High",
  "likelyThreats": ["threat1", "threat2"],
  "preventionSteps": "<2-3 prevention measures>",
  "keyAction": "<one clear immediate action>"
}`;

  const user = `Farmer's situation: ${farmerInput}
Blackboard so far: ${JSON.stringify(blackboard)}`;
  const raw = await callGemini(apiKey, system, user);
  try {
    return JSON.parse(raw.trim());
  } catch {
    return { agent: "Pest & Disease Specialist", raw, parseError: true };
  }
};

// ── Agent 4: Risk Alert Agent ─────────────────────────────────────────────────
export const riskAlertAgent = async (apiKey, farmerInput, blackboard) => {
  const system = `You are a Risk Alert Agent in an Agricultural Advisory Control Room.
Your sole job: detect URGENT weather, climate, or environmental hazards.
If a hazard exists, set urgent=true with a short warning. Otherwise urgent=false.
Respond ONLY in this JSON format (no markdown fences):
{
  "agent": "Risk Alert",
  "urgent": true,
  "hazardType": "<type of hazard e.g. Frost/Drought/Flood/Heatwave/Pest Outbreak>",
  "warning": "<1-2 sentence urgent warning to the farmer>",
  "immediateAction": "<what to do RIGHT NOW>"
}
OR if no urgent risk:
{
  "agent": "Risk Alert",
  "urgent": false,
  "note": "<brief note that conditions look safe>"
}`;

  const user = `Farmer's situation: ${farmerInput}
Full blackboard: ${JSON.stringify(blackboard)}`;
  const raw = await callGemini(apiKey, system, user);
  try {
    return JSON.parse(raw.trim());
  } catch {
    return { agent: "Risk Alert", urgent: false, raw, parseError: true };
  }
};

// ── Agent 5: Advisor Coordinator ─────────────────────────────────────────────
export const coordinatorAgent = async (apiKey, farmerInput, blackboard, riskAlert) => {
  const system = `You are the Advisor Coordinator in an Agricultural Advisory Control Room.
You have received findings from multiple specialist agents on the blackboard.
Synthesize everything into a single friendly, plain-language advisory for the farmer.
Write 3-5 clear paragraphs. No bullet lists in the final advice — flowing prose only.
Start with any urgent risk warning if present, then give holistic, actionable advice.
Be warm, encouraging, and practical. Address the farmer directly as "you".`;

  const user = `Farmer's original query: ${farmerInput}

Risk Alert: ${JSON.stringify(riskAlert)}

Blackboard (all specialist findings):
${JSON.stringify(blackboard, null, 2)}

Write the final combined advisory now:`;

  return await callGemini(apiKey, system, user);
};
