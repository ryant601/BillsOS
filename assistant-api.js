"use strict";

const cashflow = require("./cashflow-engine");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const INTENT_BUILD = "assistant-intent-20260630-1";

function compactBillsContext(data) {
  const src = data && typeof data === "object" ? data : {};
  const bills = Array.isArray(src.bills) ? src.bills : [];
  const income = Array.isArray(src.income) ? src.income : [];
  const oneTimeEvents = Array.isArray(src.oneTimeEvents) ? src.oneTimeEvents : [];
  return {
    updatedAt: src.updatedAt || null,
    bills: bills.filter(row => row && row.active !== false).slice(0, 80).map(row => ({ name: row.name || "Bill", amount: Number(row.amount || 0), dueDay: row.dueDay || null, frequency: row.frequency || "monthly", startMonth: row.startMonth || null, endMonth: row.endMonth || null })),
    income: income.filter(row => row && row.active !== false).slice(0, 20).map(row => ({ name: row.name || "Income", amount: Number(row.amount || 0), schedule: row.schedule || "manual" })),
    oneTimeEvents: oneTimeEvents.filter(row => row && row.id !== "__billsos_system_rules__").slice(0, 60).map(row => ({ name: row.name || "One-time item", amount: Number(row.amount || 0), date: row.date || null, type: row.type || null, notes: row.notes || "" }))
  };
}

function plainText(value) {
  return String(value || "").replace(/<\/?(?:b|p|ul|ol|li)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function esc(value) {
  return String(value || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
}

function normalizeDashboardProjection(html) {
  if (typeof html !== "string") return html;
  return html.replace(/mm\[0\]==='june'\?0:bal/g, "bal").replace(/push\(Math\.min\(dim,Math\.max\(1,base\+add\)\),'Spending account funding',-Math\.abs\(Number\(sp\.amount\)\),'out system','rule'\)/g, "var fundDay=Math.min(dim,Math.max(1,base+add)),fundAmt=safeSweepAmount(fundDay,sp.amount);if(fundAmt>0)push(fundDay,'Spending account funding',-fundAmt,'out system','rule')").replace(/push\(base,'Spending account funding',-Math\.abs\(Number\(sp\.amount\)\),'out system','rule'\)/g, "var fundDay=base,fundAmt=safeSweepAmount(fundDay,sp.amount);if(fundAmt>0)push(fundDay,'Spending account funding',-fundAmt,'out system','rule')");
}

function injectBridge(html) {
  let out = normalizeDashboardProjection(html);
  if (typeof out !== "string") return out;
  const scripts = [
    '<script id="billsosCashflowEngine" defer src="/cashflow-engine.js?v=20260630engine1"></script>',
    '<script id="billsosAssistantUi" defer src="/assistant-ui.js?v=20260630assistant7"></script>',
    '<script id="billsosAssistantAiBridge" defer src="/assistant-ai-bridge.js?v=20260630bridge7"></script>'
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
    temperature: 0.2,
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
  else if (/best|when|day|date|pay|payment/.test(text) && amount) intent = "payment_timing";
  else if (/upcoming|coming up|bills|due|next bill/.test(text)) intent = "upcoming_bills";
  else if (/lowest|low|minimum|floor|risk|buffer|projection/.test(text)) intent = "low_balance";
  else if (/summary|status|where.*stand|current read/.test(text)) intent = "summary";
  const scope = cashflow.scopeFromQuestion(question);
  return { intent, amount: amount || null, dateStart: scope.start, dateEnd: scope.end, scopeLabel: scope.label, confidence: intent === "unknown" ? 0.35 : 0.7, requiresConfirmation: false };
}

function cleanIntent(intent, question) {
  const local = localIntent(question);
  const src = intent && typeof intent === "object" ? intent : {};
  const allowed = ["payment_timing", "affordability", "low_balance", "upcoming_bills", "summary", "unknown"];
  const out = {
    intent: allowed.includes(src.intent) ? src.intent : local.intent,
    amount: src.amount != null && !isNaN(Number(src.amount)) ? Number(src.amount) : local.amount,
    dateStart: /^20\d{2}-\d{2}-\d{2}$/.test(String(src.dateStart || "")) ? src.dateStart : local.dateStart,
    dateEnd: /^20\d{2}-\d{2}-\d{2}$/.test(String(src.dateEnd || "")) ? src.dateEnd : local.dateEnd,
    scopeLabel: src.scopeLabel || local.scopeLabel,
    target: src.target || null,
    constraints: Array.isArray(src.constraints) ? src.constraints.slice(0, 8).map(String) : [],
    requiresConfirmation: !!src.requiresConfirmation,
    confidence: Math.max(0, Math.min(1, Number(src.confidence == null ? local.confidence : src.confidence))),
    clarificationQuestion: src.clarificationQuestion || null
  };
  if ((out.intent === "payment_timing" || out.intent === "affordability") && !out.amount) out.intent = local.intent;
  return out;
}

async function parseIntentWithOpenAI(question, data) {
  if (!OPENAI_API_KEY) return { mode: "local", intent: localIntent(question) };
  const payload = await openAIResponse({
    model: OPENAI_MODEL,
    temperature: 0,
    max_output_tokens: 300,
    instructions: [
      "You parse BillsOS user requests into strict JSON only.",
      "Do not calculate balances. BillsOS will calculate after you classify the request.",
      "Return only valid JSON with keys: intent, amount, dateStart, dateEnd, scopeLabel, target, constraints, requiresConfirmation, confidence, clarificationQuestion.",
      "Allowed intent values: payment_timing, affordability, low_balance, upcoming_bills, summary, unknown.",
      "Use ISO dates. If the user gives a month, use the full month in 2026. If the user says next 3 weeks, use the supplied currentDate as the start and currentDate plus 21 days as the end.",
      "requiresConfirmation must be true only for data-changing requests, such as move, add, delete, mark paid, or change."
    ].join("\n"),
    input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify({ currentDate: cashflow.today(), userQuestion: question, billsContext: compactBillsContext(data) }) }] }]
  });
  const parsed = extractJson(outputText(payload));
  return { mode: "openai", intent: parsed || localIntent(question) };
}

function scopeFromIntent(intent, question) {
  const fallback = cashflow.scopeFromQuestion(question);
  return {
    start: intent.dateStart || fallback.start,
    end: intent.dateEnd || fallback.end,
    label: intent.scopeLabel || fallback.label
  };
}

function renderDeterministic(intent, question, data) {
  const model = cashflow.build(data);
  const scope = scopeFromIntent(intent, question);
  const amount = Number(intent.amount || cashflow.parseAmount(question) || 0);
  if (intent.requiresConfirmation) {
    return `<b>Confirmation needed</b><p>I understood this as a change request. BillsOS should show a Confirm / Cancel step before saving anything.</p>`;
  }
  if (intent.intent === "payment_timing" && amount) {
    const best = cashflow.bestPaymentDay(model, amount, scope);
    const low = cashflow.lowBalance(model, scope);
    if (!best) return `<b>I could not find projected days for ${esc(scope.label)}.</b>`;
    return `<b>${best.buffer >= 0 ? "Best fit: " : "Needs review: "}${cashflow.fmt(best.iso)}</b><ul><li>Period reviewed: ${esc(scope.label)}</li><li>Payment: <b>${cashflow.dollars(amount)}</b></li><li>Projected balance that day: <b>${cashflow.dollars(best.balance)}</b></li><li>After payment: <b>${cashflow.dollars(best.after)}</b></li><li>Buffer vs ${cashflow.dollars(cashflow.FLOOR)}: <b>${cashflow.signed(best.buffer)}</b></li>${low ? `<li>Lowest projected balance in period: ${cashflow.dollars(low.balance)} on ${cashflow.fmt(low.iso)}</li>` : ""}${best.near && best.near.length ? `<li>Nearby large items: ${best.near.slice(0, 3).map(event => `${esc(event.name)} on ${cashflow.fmt(event.iso)}`).join(", ")}</li>` : `<li>No large bill cluster within 3 days.</li>`}</ul>`;
  }
  if (intent.intent === "affordability" && amount) {
    const low = cashflow.lowBalance(model, scope);
    const best = cashflow.bestPaymentDay(model, amount, scope);
    if (!low || !best) return `<b>I could not find projected balances for ${esc(scope.label)}.</b>`;
    const after = Math.max(0, low.balance - amount);
    return `<b>${after >= cashflow.FLOOR ? "Looks workable" : "Needs review"}</b><ul><li>Period reviewed: ${esc(scope.label)}</li><li>Amount: <b>${cashflow.dollars(amount)}</b></li><li>Lowest projected balance: ${cashflow.dollars(low.balance)} on ${cashflow.fmt(low.iso)}</li><li>Lowest balance after payment: <b>${cashflow.dollars(after)}</b></li><li>Best timing found: ${cashflow.fmt(best.iso)} after projected balance ${cashflow.dollars(best.after)}</li></ul>`;
  }
  if (intent.intent === "low_balance") {
    const low = cashflow.lowBalance(model, scope);
    return low ? `<b>Lowest projected balance</b><ul><li>Period reviewed: ${esc(scope.label)}</li><li>${cashflow.fmt(low.iso)}: <b>${cashflow.dollars(low.balance)}</b></li></ul>` : `<b>No projected balances found for ${esc(scope.label)}.</b>`;
  }
  if (intent.intent === "upcoming_bills") {
    const items = cashflow.openEvents(model, scope).filter(event => !cashflow.isIncome(event)).slice(0, 8);
    return `<b>Upcoming open items</b><ul><li>Period reviewed: ${esc(scope.label)}</li>${items.length ? items.map(event => `<li>${cashflow.fmt(event.iso)} · ${esc(event.name)} · <b>${esc(event.amountText || cashflow.dollars(Math.abs(event.amount)))}</b></li>`).join("") : "<li>No open bill items found.</li>"}</ul>`;
  }
  if (intent.intent === "summary") {
    const s = { start: cashflow.today(), end: cashflow.addDays(cashflow.today(), 30), label: "next 30 days" };
    const events = cashflow.openEvents(model, s);
    const income = events.find(cashflow.isIncome);
    const bill = events.find(event => !cashflow.isIncome(event));
    const low = cashflow.lowBalance(model, s);
    return `<b>Current BillsOS read</b><ul><li>Next income: ${income ? `${cashflow.fmt(income.iso)} · ${esc(income.name)}` : "—"}</li><li>Next bill: ${bill ? `${cashflow.fmt(bill.iso)} · ${esc(bill.name)} · ${esc(bill.amountText)}` : "—"}</li><li>Open items in next 30 days: ${events.filter(event => !cashflow.isIncome(event)).length}</li><li>30-day low: ${low ? `${cashflow.dollars(low.balance)} on ${cashflow.fmt(low.iso)}` : "—"}</li></ul>`;
  }
  return `<b>I can answer BillsOS questions.</b><ul><li>“Lowest balance in October”</li><li>“Best day to pay $500 in July”</li><li>“Can I afford $800 this month?”</li><li>“What bills are coming up next month?”</li></ul>`;
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
    res.json({ configured: !!OPENAI_API_KEY, model: OPENAI_MODEL, engine: cashflow.BUILD, intent: INTENT_BUILD, assistant: "assistant-ui-20260630-7", bridge: "assistant-ai-bridge-20260630-7", projectionGuard: "enabled" });
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
      const intent = cleanIntent(parsed.intent, question);
      const answer = renderDeterministic(intent, question, data);
      res.json({ mode: parsed.mode, model: parsed.mode === "openai" ? OPENAI_MODEL : null, build: INTENT_BUILD, intent, answer, deterministicAnswer: plainText(answer), error: parsed.error || null });
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
