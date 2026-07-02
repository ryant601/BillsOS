"use strict";

const cashflow = require("./cashflow-engine");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.CHATGPT_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.CHATGPT_MODEL || "gpt-4.1-mini";
const INTENT_BUILD = "assistant-intent-20260702-6";

function compactBillsContext(data) {
  const src = data && typeof data === "object" ? data : {};
  const bills = Array.isArray(src.bills) ? src.bills : [];
  const income = Array.isArray(src.income) ? src.income : [];
  const oneTimeEvents = Array.isArray(src.oneTimeEvents) ? src.oneTimeEvents : [];
  return {
    updatedAt: src.updatedAt || null,
    bills: bills.filter(row => row && row.active !== false).slice(0, 80).map(row => ({
      name: row.name || "Bill",
      amount: Number(row.amount || 0),
      dueDay: row.dueDay || null,
      frequency: row.frequency || "monthly",
      startMonth: row.startMonth || null,
      endMonth: row.endMonth || null
    })),
    income: income.filter(row => row && row.active !== false).slice(0, 20).map(row => ({
      name: row.name || "Income",
      amount: Number(row.amount || 0),
      schedule: row.schedule || "manual"
    })),
    oneTimeEvents: oneTimeEvents.filter(row => row && row.id !== "__billsos_system_rules__" && row.id !== "__billsos_action_log__").slice(0, 60).map(row => ({
      name: row.name || "One-time item",
      amount: Number(row.amount || 0),
      date: row.date || null,
      type: row.type || null,
      notes: row.notes || ""
    }))
  };
}

function plainText(value) {
  return String(value || "")
    .replace(/<\/?(?:b|p|ul|ol|li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeDashboardProjection(html) {
  if (typeof html !== "string") return html;
  return html
    .replace(/mm\[0\]==='june'\?0:bal/g, "bal")
    .replace(/push\(Math\.min\(dim,Math\.max\(1,base\+add\)\),'Spending account funding',-Math\.abs\(Number\(sp\.amount\)\),'out system','rule'\)/g, "var fundDay=Math.min(dim,Math.max(1,base+add)),fundAmt=safeSweepAmount(fundDay,sp.amount);if(fundAmt>0)push(fundDay,'Spending account funding',-fundAmt,'out system','rule')")
    .replace(/push\(base,'Spending account funding',-Math\.abs\(Number\(sp\.amount\)\),'out system','rule'\)/g, "var fundDay=base,fundAmt=safeSweepAmount(fundDay,sp.amount);if(fundAmt>0)push(fundDay,'Spending account funding',-fundAmt,'out system','rule')");
}

function injectBridge(html) {
  let out = normalizeDashboardProjection(html);
  if (typeof out !== "string") return out;
  const scripts = [
    '<script id="billsosCashflowEngine" defer src="/cashflow-engine.js?v=20260630engine1"></script>',
    '<script id="billsosAssistantUi" defer src="/assistant-ui.js?v=20260702qavg1"></script>',
    '<script id="billsosAssistantAiBridge" defer src="/assistant-ai-bridge.js?v=20260702bridge3"></script>'
  ].filter(script => !out.includes(script.match(/id="([^"]+)"/)[1])).join("\n");
  if (!scripts) return out;
  if (out.includes("</body>")) return out.replace("</body>", `${scripts}\n</body>`);
  return out + scripts;
}

function outputText(payload) {
  return payload.output_text || (Array.isArray(payload.output) ? payload.output.map(item => Array.isArray(item.content) ? item.content.map(part => part.text || "").join(" ") : "").join(" ").trim() : "");
}

async function openAIResponse(body) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload && payload.error && payload.error.message ? payload.error.message : `OpenAI HTTP ${response.status}`);
  return payload;
}

async function callOpenAI({ question, deterministicAnswer, billsContext }) {
  const payload = await openAIResponse({
    model: OPENAI_MODEL,
    max_output_tokens: 450,
    instructions: [
      "You are the BillsOS assistant for a private household budget app.",
      "BillsOS performs the calculations. Treat the deterministic BillsOS result as the source of truth.",
      "Do not invent balances, due dates, income, or affordability conclusions.",
      "Use the BillsOS data only to clarify wording or context.",
      "Answer calmly and concisely. Use short bullets when useful.",
      "If the user asks to change data, say that BillsOS should ask for confirmation before saving."
    ].join("\n"),
    input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify({ userQuestion: question, deterministicBillsOSResult: deterministicAnswer, billsContext }) }] }]
  });
  return outputText(payload) || deterministicAnswer;
}

function extractJson(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(raw); } catch (_err) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_err) {}
  }
  return null;
}

function localIntent(question) {
  const text = String(question || "").toLowerCase();
  const amount = cashflow.parseAmount(question);
  let intent = "unknown";
  if (/afford|spend|buy|can i/.test(text) && amount) intent = "affordability";
  else if (/best|when|day|date|pay|payment|safest/.test(text) && amount) intent = "payment_timing";
  else if (/upcoming|coming up|bills|due|next bill/.test(text)) intent = "upcoming_bills";
  else if (/lowest|low|minimum|floor|risk|buffer|projection/.test(text)) intent = "low_balance";
  else if (/summary|status|where.*stand|current read/.test(text)) intent = "summary";
  else if (/average|avg|daily spend|monthly spend|spend per day|spend per month|quarter|q[1-4]/.test(text)) intent = "spend_average";
  const scope = cashflow.scopeFromQuestion(question);
  return {
    intent,
    amount: amount || null,
    dateStart: scope.start,
    dateEnd: scope.end,
    scopeLabel: scope.label,
    confidence: intent === "unknown" ? 0.35 : 0.7,
    requiresConfirmation: false
  };
}

async function parseIntentWithOpenAI(question, data) {
  if (!OPENAI_API_KEY) return { mode: "local", intent: localIntent(question) };
  const payload = await openAIResponse({
    model: OPENAI_MODEL,
    max_output_tokens: 300,
    instructions: [
      "You parse BillsOS user requests into strict JSON only.",
      "Do not calculate balances. The BillsOS all-months cashflow engine calculates balances.",
      "Return only valid JSON with keys: intent, amount, dateStart, dateEnd, scopeLabel, target, constraints, requiresConfirmation, confidence, clarificationQuestion.",
      "Allowed intent values: payment_timing, affordability, low_balance, upcoming_bills, spend_average, summary, unknown.",
      "requiresConfirmation must be true only for data-changing requests, such as move, add, delete, mark paid, or change."
    ].join("\n"),
    input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify({ currentDate: cashflow.today(), userQuestion: question, billsContext: compactBillsContext(data) }) }] }]
  });
  return { mode: "openai", intent: extractJson(outputText(payload)) || localIntent(question) };
}

module.exports = function registerAssistantApi(app, options) {
  const readBillsData = options && options.readBillsData;

  app.use((req, res, next) => {
    if (req.path !== "/" && req.path !== "/generated") return next();
    const originalSend = res.send.bind(res);
    res.send = body => originalSend(injectBridge(body));
    next();
  });

  app.get("/api/assistant/status", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      configured: !!OPENAI_API_KEY,
      model: OPENAI_MODEL,
      engine: cashflow.BUILD,
      intent: INTENT_BUILD,
      assistant: "assistant-ui-20260702-qavg1",
      bridge: "assistant-ai-bridge-20260702-3",
      assistantSource: "cashflow-engine-all-months",
      projectionGuard: "enabled",
      envAccepted: ["OPENAI_API_KEY", "OPENAI_KEY", "CHATGPT_API_KEY"].filter(name => !!process.env[name])
    });
  });

  app.get("/api/assistant/test", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      if (!OPENAI_API_KEY) return res.status(501).json({ ok: false, configured: false, error: "OPENAI_API_KEY is not configured" });
      const answer = await callOpenAI({ question: "Test BillsOS assistant connection", deterministicAnswer: "BillsOS calculated a projected low balance of $1,250. Explain this in one sentence.", billsContext: compactBillsContext(typeof readBillsData === "function" ? readBillsData() : {}) });
      res.json({ ok: true, model: OPENAI_MODEL, answer });
    } catch (err) {
      res.status(500).json({ ok: false, configured: !!OPENAI_API_KEY, model: OPENAI_MODEL, error: err && err.message ? err.message : "Assistant test failed" });
    }
  });

  app.post("/api/assistant/intent", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const question = String((req.body && req.body.question) || "").trim().slice(0, 1000);
      if (!question) return res.status(400).json({ error: "Question is required" });
      const data = typeof readBillsData === "function" ? readBillsData() : {};
      const parsed = await parseIntentWithOpenAI(question, data).catch(err => ({ mode: "local", error: err && err.message ? err.message : "Intent parse failed", intent: localIntent(question) }));
      res.json({ mode: parsed.mode, model: parsed.mode === "openai" ? OPENAI_MODEL : null, build: INTENT_BUILD, intent: parsed.intent || localIntent(question), answer: null, error: parsed.error || null });
    } catch (err) {
      res.status(500).json({ error: err && err.message ? err.message : "Intent request failed" });
    }
  });

  app.post("/api/assistant", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const question = String((req.body && req.body.question) || "").trim().slice(0, 1000);
      const deterministicAnswer = plainText((req.body && req.body.deterministicAnswer) || "").slice(0, 4000);
      if (!question) return res.status(400).json({ error: "Question is required" });
      if (!deterministicAnswer) return res.status(400).json({ error: "Deterministic BillsOS result is required" });
      if (!OPENAI_API_KEY) return res.status(501).json({ mode: "local", enabled: false, error: "OPENAI_API_KEY is not configured" });
      const billsContext = compactBillsContext(typeof readBillsData === "function" ? readBillsData() : {});
      const answer = await callOpenAI({ question, deterministicAnswer, billsContext });
      res.json({ mode: "openai", enabled: true, model: OPENAI_MODEL, answer });
    } catch (err) {
      res.status(500).json({ mode: "local", enabled: !!OPENAI_API_KEY, error: err && err.message ? err.message : "Assistant request failed" });
    }
  });
};
