// agents.js — Blackboard Architecture Agents using Gemini AI
// Each agent reads farmer context + blackboard, writes its result to the board.

import { GoogleGenerativeAI } from "@google/generative-ai";

const getGenAI = (apiKey) => new GoogleGenerativeAI(apiKey);

const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
];

const CALL_TIMEOUT_MS = 25000;
const MAX_ATTEMPTS = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms
      )
    ),
  ]);

const extractJson = (raw, fallback) => {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return { ...fallback, ...JSON.parse(cleaned) };
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return { ...fallback, ...JSON.parse(cleaned.slice(start, end + 1)) };
      } catch {
        /* fall through */
      }
    }
    return { ...fallback, raw: cleaned, parseError: true };
  }
};

const callGemini = async (apiKey, systemPrompt, userPrompt, onStatus) => {
  const genAI = getGenAI(apiKey);
  let lastError = null;

  for (let modelIdx = 0; modelIdx < MODELS.length; modelIdx++) {
    const modelName = MODELS[modelIdx];
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        onStatus?.(`Trying ${modelName} (attempt ${attempt})...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });
        const result = await withTimeout(
          model.generateContent(userPrompt),
          CALL_TIMEOUT_MS,
          modelName
        );
        const text = result.response.text();
        if (!text?.trim()) {
          throw new Error("Empty response from model");
        }
        return text;
      } catch (err) {
        lastError = err;
        const msg = err.message || String(err);
        const is429 =
          msg.includes("429") ||
          msg.includes("quota") ||
          msg.includes("exceeded") ||
          msg.includes("RESOURCE_EXHAUSTED");
        const is503 =
          msg.includes("503") ||
          msg.includes("overloaded") ||
          msg.includes("high demand") ||
          msg.includes("UNAVAILABLE");
        const is404 =
          msg.includes("404") ||
          msg.includes("not found") ||
          msg.includes("no longer available");
        const timedOut = msg.toLowerCase().includes("timed out");

        if (is404) {
          onStatus?.(`${modelName} is unavailable, switching model...`);
          break;
        }
        if ((is429 || is503 || timedOut) && attempt < MAX_ATTEMPTS) {
          const wait = is503 ? 1500 * attempt : 800;
          onStatus?.(
            `${is429 ? "Rate limited" : timedOut ? "Slow response" : "Model busy"} — retrying in ${(wait / 1000).toFixed(1)}s...`
          );
          await sleep(wait);
          continue;
        }
        if (is429 || is503 || timedOut || attempt === MAX_ATTEMPTS) {
          onStatus?.(`${modelName} failed, trying next model...`);
          break;
        }
        throw err;
      }
    }
  }

  throw new Error(
    lastError?.message
      ? `Gemini did not respond in time (${lastError.message}). Wait a few seconds and try again.`
      : "All models are busy. Please wait a few seconds and try again."
  );
};

export const soilCropAgent = async (apiKey, farmerInput, onStatus) => {
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
  const raw = await callGemini(apiKey, system, user, onStatus);
  return extractJson(raw, { agent: "Soil & Crop Specialist" });
};

export const waterAgent = async (apiKey, farmerInput, blackboard, onStatus) => {
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
  const raw = await callGemini(apiKey, system, user, onStatus);
  return extractJson(raw, { agent: "Water & Irrigation Specialist" });
};

export const pestAgent = async (apiKey, farmerInput, blackboard, onStatus) => {
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
  const raw = await callGemini(apiKey, system, user, onStatus);
  return extractJson(raw, { agent: "Pest & Disease Specialist" });
};

export const riskAlertAgent = async (apiKey, farmerInput, blackboard, onStatus) => {
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
  const raw = await callGemini(apiKey, system, user, onStatus);
  return extractJson(raw, { agent: "Risk Alert", urgent: false });
};

export const coordinatorAgent = async (
  apiKey,
  farmerInput,
  blackboard,
  riskAlert,
  onStatus
) => {
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

  return await callGemini(apiKey, system, user, onStatus);
};
