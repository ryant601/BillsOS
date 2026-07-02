"use strict";

const cashflow = require("./cashflow-engine");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.CHATGPT_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.CHATGPT_MODEL || "gpt-4.1-mini";
const INTENT_BUILD = "assistant-intent-20260702-9";

function compactBillsContext(data) {
  const src = data && typeof data === "object" ? data : {};
  const bills = Array.isArray(src.bills) ? src.bills : [];
  const income = Array.isArray(src.income) ? src.income : [];
  const oneTimeEvents = Array.isArray(src.oneTimeEvents) ? src.oneTimeEvents : [];
  return {
    updatedAt: src.updatedAt || null,
    planningYear: 2026,
    availableMonths: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"],
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

function replaceScriptById(html, id, src) {
  const tag = `<script id="${id}" defer src="${src}"></script>`;
  const re = new RegExp(`<script[^>]*id=["']${id}["'][^>]*><\\/script>`, "i");
  if (re.test(html)) return html.replace(re, tag);
  if (html.includes("</body>")) return html.replace("</body>", `${tag}\n</body>`);
  return html + tag;
}

function injectBridge(html) {
  let out = normalizeDashboardProjection(html);
  if (typeof out !== "string") return out;
  out = replaceScriptById(out, "billsosCashflowEngine", "/cashflow-engine.js?v=20260630engine1");
  out = replaceScriptById(out, "billsosAssistantUi", "/assistant-ui.js?v=20260702intent3");
  out = replaceScriptById(out, "billsosAssistantAiBridge", "/assistant-ai-bridge.js?v=20260702bridge4");
  return out;
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

function validIso(value) {
  return /^20\d{2}-\d{2}-\d{2}$/.test(String(value || ""));
}

function fixedScopeIntent(intent, start, end, label, patchReason) {
  return {
    ...(intent || {}),
    dateStart: start,
    dateEnd: end,
    scopeLabel: label,
    constraints: { ...((intent && intent.constraints) || {}), scopePatch: patchReason },
    confidence: Math.max(Number((intent && intent.confidence) || 0), 0.95)
  };
}

function correctIntent(question, intent) {
  const text = String(question || "").toLowerCase();
  let out = intent && typeof intent === "object" ? { ...intent } : localIntent(question, false);

  const q = text.match(/\bq([1-4])\b|\b([1-4])(?:st|nd|rd|th)?\s+quarter\b/);
  if (q) {
    const quarter = Number(q[1] || q[2]);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const year = 2026;
    const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
    const end = `${year}-${String(endMonth).padStart(2, "0")}-${String(new Date(year, endMonth, 0).getDate()).padStart(2, "0")}`;
    out = fixedScopeIntent(out, start, end, `Q${quarter}`, "deterministic-quarter");
    if (/average|avg|spend|outflow|monthly|daily/.test(text)) out.intent = "spend_average";
    if (/monthly|per month/.test(text)) out.constraints = { ...(out.constraints || {}), aggregation: "monthly" };
  }

  if (text.includes("thanksgiving")) {
    const day = "2026-11-26";
    const window = text.match(/(\d+)\s+days?\s+before\s+and\s+after/) || text.match(/(\d+)\s+days?\s+around/);
    if (window) {
      const n = Number(window[1]);
      const start = cashflow.addDays ? cashflow.addDays(day, -n) : "2026-11-23";
      const end = cashflow.addDays ? cashflow.addDays(day, n) : "2026-11-29";
      out = fixedScopeIntent(out, start, end, `Thanksgiving ± ${n} days`, "deterministic-holiday");
    } else {
      out = fixedScopeIntent(out, day, day, "Thanksgiving Day", "deterministic-holiday");
    }
    if (/outflow|outflows|bill|bills|projected|that day|coming up|due/.test(text)) {
      out.intent = "upcoming_bills";
      out.constraints = { ...(out.constraints || {}), flow: "outflow" };
    }
  }

  if (!validIso(out.dateStart) || !validIso(out.dateEnd)) {
    const fallback = cashflow.scopeFromQuestion(question);
    out.dateStart = fallback.start;
    out.dateEnd = fallback.end;
    out.scopeLabel = fallback.label;
    out.constraints = { ...(out.constraints || {}), scopePatch: "fallback-scope" };
  }

  return out;
}

function localIntent(question, applyCorrection = true) {
  const text = String(question || "").toLowerCase();
  const amount = cashflow.parseAmount(question);
  let intent = "unknown";
  if (/outflow|outflows|projected.*that day|that day|specific day|thanksgiving|christmas/.test(text)) intent = "upcoming_bills";
  else if (/average|avg|daily spend|monthly spend|spend per day|spend per month|quarter|q[1-4]/.test(text)) intent = "spend_average";
  else if (/afford|spend|buy|can i/.test(text) && amount) intent = "affordability";
  else if (/best|when|day|date|pay|payment|safest/.test(text) && amount) intent = "payment_timing";
  else if (/upcoming|coming up|bills|due|next bill/.test(text)) intent = "upcoming_bills";
  else if (/lowest|low|minimum|floor|risk|buffer|projection/.test(text)) intent = "low_balance";
  else if (/summary|status|where.*stand|current read/.test(text)) intent = "summary";
  const scope = cashflow.scopeFromQuestion(question);
  const base = {
    intent,
    amount: amount || null,
    dateStart: scope.start,
    dateEnd: scope.end,
    scopeLabel: scope.label,
    target: null,
    constraints: {},
    confidence: intent === "unknown" ? 0.35 : 0.7,
    requiresConfirmation: false
  };
  return applyCorrection ? correctIntent(question, base) : base;
}

async function parseIntentWithOpenAI(question, data) {
  if (!OPENAI_API_KEY) return { mode: "local", intent: localIntent(question) };
  const payload = await openAIResponse({
    model: OPENAI_MODEL,
    max_output_tokens: 350,
    instructions: [
      "You parse BillsOS user requests into strict JSON only.",
      "Do not calculate balances or totals. BillsOS calculates numbers after your parse.",
      "Your primary job is natural-language interpretation: date ranges, periods, metrics, aggregation, and user intent.",
      "Use planning year 2026 unless the user explicitly gives another year.",
      "BillsOS currently has month data from 2026-06 through 2026-12.",
      "Interpret quarters normally: Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec. For Q4 return 2026-10-01 through 2026-12-31.",
      "For Thanksgiving 2026, use 2026-11-26. For Christmas 2026, use 2026-12-25.",
      "For three days before and after Thanksgiving, return 2026-11-23 through 2026-11-29.",
      "For named months, holidays, phrases like first half of November, after Thanksgiving, before Christmas, and next month, return concrete ISO dateStart/dateEnd.",
      "Do not default broad named periods like Q4, October, December, or Thanksgiving to next 30 days.",
      "Return only valid JSON with keys: intent, amount, dateStart, dateEnd, scopeLabel, target, constraints, requiresConfirmation, confidence, clarificationQuestion.",
      "Allowed intent values: payment_timing, affordability, low_balance, upcoming_bills, spend_average, summary, unknown.",
      "For outflow/list questions about a day or window, use intent upcoming_bills and constraints.flow='outflow'.",
      "For average spend questions, use intent spend_average and put aggregation in constraints.aggregation as daily, weekly, monthly, or period_total when clear.",
      "requiresConfirmation must be true only for data-changing requests, such as move, add, delete, mark paid, or change."
    ].join("\n"),
    input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify({ currentDate: cashflow.today(), planningYear: 2026, userQuestion: question, billsContext: compactBillsContext(data) }) }] }]
  });
  return { mode: "openai", intent: correctIntent(question, extractJson(outputText(payload)) || localIntent(question)) };
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
      assistant: "assistant-ui-20260702-intent3",
      bridge: "assistant-ai-bridge-20260702-4",
      assistantSource: "cashflow-engine-all-months",
      interpretation: "openai-intent-first",
      intentValidator: "deterministic-period-guardrails",
      scriptLoader: "replace-script-by-id",
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
      res.json({ mode: parsed.mode, model: parsed.mode === "openai" ? OPENAI_MODEL : null, build: INTENT_BUILD, intent: correctIntent(question, parsed.intent || localIntent(question)), answer: null, error: parsed.error || null });
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
