"use strict";

const cashflow = require("./cashflow-engine");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.CHATGPT_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.CHATGPT_MODEL || "gpt-4.1-mini";
const INTENT_BUILD = "assistant-plan-20260820-query2";

function compactBillsContext(data) {
  const src = data && typeof data === "object" ? data : {};
  const bills = Array.isArray(src.bills) ? src.bills : [];
  const income = Array.isArray(src.income) ? src.income : [];
  const oneTimeEvents = Array.isArray(src.oneTimeEvents) ? src.oneTimeEvents : [];
  return {
    updatedAt: src.updatedAt || null,
    planningYear: 2026,
    availableMonths: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"],
    billNames: bills.filter(row => row && row.active !== false).slice(0, 100).map(row => row.name || "Bill"),
    incomeNames: income.filter(row => row && row.active !== false).slice(0, 30).map(row => row.name || "Income"),
    oneTimeNames: oneTimeEvents.filter(row => row && !String(row.id || "").startsWith("__billsos_")).slice(0, 80).map(row => row.name || "One-time item")
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
  return html.replace(/mm\[0\]==='june'\?0:bal/g, "bal");
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
  out = replaceScriptById(out, "billsosCashflowEngine", "/cashflow-engine.js?v=20260820lowbalance300");
  out = replaceScriptById(out, "billsosAssistantUi", "/assistant-ui.js?v=20260820format1");
  out = replaceScriptById(out, "billsosAssistantAiBridge", "/assistant-ai-bridge.js?v=20260820format1");
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
    max_output_tokens: 500,
    instructions: [
      "You are the BillsOS assistant for a private household budget app.",
      "BillsOS performs every calculation. Treat the deterministic BillsOS result as the source of truth.",
      "Do not invent balances, due dates, income, totals, or affordability conclusions.",
      "Preserve all important dates and amounts from the deterministic result.",
      "Answer the user's exact question directly, calmly, and concisely.",
      "Use a short headline and bullets when useful.",
      "If the deterministic result reports an unsupported data-changing action, explain that confirmation is required."
    ].join("\n"),
    input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify({ userQuestion: question, deterministicBillsOSResult: deterministicAnswer, billsContext }) }] }]
  });
  const answer = outputText(payload) || deterministicAnswer;
  return answerPreservesFacts(question, deterministicAnswer, answer) ? answer : deterministicAnswer;
}

function normalizedMoneyFacts(value) {
  const found = String(value || "").match(/\$\s*-?[0-9][0-9,]*(?:\.\d{1,2})?/g) || [];
  return [...new Set(found.map(item => Number(item.replace(/[$,\s]/g, "")).toFixed(2)))];
}

function normalizedDateFacts(value) {
  const found = String(value || "").match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}\b/gi) || [];
  return [...new Set(found.map(item => item.toLowerCase().replace(/\./g, "").replace(/^(january|jan)/, "jan").replace(/^(february|feb)/, "feb").replace(/^(march|mar)/, "mar").replace(/^(april|apr)/, "apr").replace(/^(june|jun)/, "jun").replace(/^(july|jul)/, "jul").replace(/^(august|aug)/, "aug").replace(/^(september|sept|sep)/, "sep").replace(/^(october|oct)/, "oct").replace(/^(november|nov)/, "nov").replace(/^(december|dec)/, "dec")))];
}

function answerPreservesFacts(question, deterministicAnswer, answer) {
  const q = String(question || "").toLowerCase();
  const a = String(answer || "").toLowerCase();
  const answerMoney = normalizedMoneyFacts(answer);
  const answerDates = normalizedDateFacts(answer);
  if (!normalizedMoneyFacts(deterministicAnswer).every(value => answerMoney.includes(value))) return false;
  if (!normalizedDateFacts(deterministicAnswer).every(value => answerDates.includes(value))) return false;
  if (/\bfund(?:ing)?\b/.test(q) && !/\bfund(?:ing)?\b/.test(a)) return false;
  if (/\bsweep\b/.test(q) && !/\bsweep\b/.test(a)) return false;
  if (/one detail would help/i.test(deterministicAnswer) && !/(?:detail|clarif|calculate|what would you like|could you specify)/i.test(answer)) return false;
  return true;
}

function validIso(value) {
  return /^20\d{2}-\d{2}-\d{2}$/.test(String(value || ""));
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

function amountFromText(text) {
  const money = String(text || "").match(/(?:\$|under\s+|below\s+|over\s+|above\s+)(-?[0-9][0-9,]*(?:\.\d{1,2})?)/i);
  return money ? Number(money[1].replace(/,/g, "")) : null;
}

function eventKindFromText(text) {
  if (/\bfund(?:ing)?\b.*\b(?:spending|account|transfer)\b|\b(?:spending|account|transfer)\b.*\bfund(?:ing)?\b|\bfunding\b/.test(text)) return "funding";
  if (/\bsweep\b/.test(text)) return "sweep";
  if (/\btransfer(?:s|red|ring)?\b|\bmove money\b/.test(text)) return "transfer";
  if (/\b(?:income|paychecks?|deposits?|money in|earnings?)\b/.test(text)) return "income";
  if (/\b(?:adjustments?|corrections?|reconciliations?)\b/.test(text)) return "adjustment";
  if (/\b(?:bills?|payments?|expenses?|outflows?|autopays?|debts?)\b/.test(text)) return "bill";
  return "all";
}

function knownEntity(question, data) {
  const q = String(question || "").toLowerCase();
  const src = data && typeof data === "object" ? data : {};
  const names = [];
  [src.bills, src.income, src.oneTimeEvents].forEach(rows => {
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const name = String(row && row.name || "").trim();
      if (name && !name.startsWith("BillsOS ")) names.push(name);
    });
  });
  return [...new Set(names)].sort((a, b) => b.length - a.length).find(name => q.includes(name.toLowerCase())) || null;
}

function summaryRequested(text) {
  return /\b(?:summary|overview|recap|snapshot)\b|how (?:am i|are we) doing|how does .* look/.test(text);
}

function localPlan(question, previousPlan, data) {
  const text = String(question || "").toLowerCase();
  const scope = cashflow.scopeFromQuestion(question);
  const parsedAmount = cashflow.parseAmount(question);
  const explicitThreshold = amountFromText(question);
  const prior = previousPlan && typeof previousPlan === "object" ? previousPlan : {};
  const inferredKind = eventKindFromText(text);
  const inferredEntity = knownEntity(question, data);
  const isFollowup = /\b(that|those|same|it|them)\b/.test(text) || /^\s*(?:and\s+)?what about\b/.test(text);
  const plan = {
    operation: "unknown",
    metric: "amount",
    dateStart: scope.start,
    dateEnd: scope.end,
    scopeLabel: scope.label,
    flow: "all",
    eventKind: inferredKind,
    comparator: null,
    threshold: null,
    amountComparator: null,
    amountThreshold: null,
    aggregation: null,
    groupBy: null,
    sort: "date_asc",
    limit: 12,
    entity: inferredEntity,
    amount: parsedAmount || null,
    completion: /\b(?:completed|paid|posted|finished)\b/.test(text) ? "completed" : /\b(?:open|unpaid|upcoming|coming up|still due)\b/.test(text) ? "open" : "all",
    includeCompleted: true,
    requiresConfirmation: /\b(move|add|delete|remove|mark paid|change|save|edit|update)\b/.test(text),
    confidence: 0.3,
    clarificationQuestion: "What would you like me to calculate from the BillsOS calendar?"
  };

  if (isFollowup && prior.operation) {
    Object.assign(plan, prior, { dateStart: scope.start, dateEnd: scope.end, scopeLabel: scope.label, clarificationQuestion: null });
  }

  if (plan.eventKind === "funding" || plan.eventKind === "sweep" || plan.eventKind === "transfer") plan.flow = "transfer";
  else if (plan.eventKind === "income") plan.flow = "income";
  else if (plan.eventKind === "bill") plan.flow = "outflow";

  if (explicitThreshold != null && /\b(?:over|above|greater than|more than)\b/.test(text)) {
    plan.amountComparator = "gt";
    plan.amountThreshold = Math.abs(explicitThreshold);
  } else if (explicitThreshold != null && /\b(?:under|below|less than|fewer than)\b/.test(text)) {
    plan.amountComparator = "lt";
    plan.amountThreshold = Math.abs(explicitThreshold);
  }

  if (/negative|below zero|under zero|overdrawn|overdraft/.test(text)) {
    plan.operation = "balance_filter";
    plan.metric = "ending_balance";
    plan.comparator = "lt";
    plan.threshold = 0;
  } else if (/below|under|less than/.test(text) && explicitThreshold != null && /balance|cash|buffer|day/.test(text)) {
    plan.operation = "balance_filter";
    plan.metric = "ending_balance";
    plan.comparator = "lt";
    plan.threshold = explicitThreshold;
  } else if (/above|over|greater than/.test(text) && explicitThreshold != null && /balance|cash|buffer|day/.test(text)) {
    plan.operation = "balance_filter";
    plan.metric = "ending_balance";
    plan.comparator = "gt";
    plan.threshold = explicitThreshold;
  } else if (/lowest|minimum|worst|tightest|smallest balance/.test(text)) {
    plan.operation = "balance_extreme";
    plan.metric = "ending_balance";
    plan.sort = "value_asc";
    plan.limit = /days|dates|list|show/.test(text) ? 10 : 1;
  } else if (/highest|maximum|best balance|largest balance/.test(text)) {
    plan.operation = "balance_extreme";
    plan.metric = "ending_balance";
    plan.sort = "value_desc";
    plan.limit = /days|dates|list|show/.test(text) ? 10 : 1;
  } else if (/how many|count|number of/.test(text)) {
    plan.operation = /balance|negative|below|under/.test(text) ? "balance_filter" : "event_aggregate";
    plan.aggregation = "count";
    if (/negative|below zero|under zero/.test(text)) { plan.comparator = "lt"; plan.threshold = 0; }
  } else if (/compare|versus|vs\.?|difference between|which month/.test(text)) {
    plan.operation = "period_compare";
    plan.metric = /balance|low|risk/.test(text) ? "minimum_balance" : /income|paycheck|deposit/.test(text) ? "income" : /net/.test(text) ? "net" : "outflow";
    plan.groupBy = "month";
    plan.sort = /best|highest/.test(text) ? "value_desc" : "value_asc";
    if (!/\b(jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/.test(text)) {
      plan.dateStart = "2026-06-01";
      plan.dateEnd = "2026-12-31";
      plan.scopeLabel = "available months";
    }
  } else if (/average|avg|per day|daily average|per month|monthly average/.test(text)) {
    plan.operation = "event_aggregate";
    plan.metric = "amount";
    plan.aggregation = "average";
    plan.groupBy = /month|monthly|quarter|q[1-4]/.test(text) ? "month" : "day";
    if (plan.flow === "all") plan.flow = /income|paycheck|deposit/.test(text) ? "income" : "outflow";
  } else if (/\b(?:total|sum|combined)\b|how much/.test(text)) {
    plan.operation = "event_aggregate";
    plan.metric = "amount";
    plan.aggregation = "sum";
    if (plan.flow === "all") plan.flow = /income|paycheck|deposit/.test(text) ? "income" : /net/.test(text) ? "all" : "outflow";
    plan.groupBy = /by month|each month|monthly/.test(text) ? "month" : null;
  } else if (/largest|biggest|most expensive|top\s+\d+/.test(text)) {
    plan.operation = "event_list";
    plan.flow = /income|paycheck|deposit/.test(text) ? "income" : "outflow";
    plan.sort = "amount_desc";
    const top = text.match(/top\s+(\d+)/);
    plan.limit = top ? Math.min(30, Math.max(1, Number(top[1]))) : 10;
  } else if (summaryRequested(text)) {
    plan.operation = "summary";
    plan.metric = "balance";
  } else if (!isFollowup && (inferredKind !== "all" || inferredEntity || /\b(?:what|which|show|list|when|amounts?|upcoming|coming up|due|items|transactions)\b/.test(text))) {
    plan.operation = "event_list";
    if (plan.flow === "all") plan.flow = /paycheck|income|deposit/.test(text) ? "income" : /all|everything|items|transactions/.test(text) ? "all" : "outflow";
  }

  if ((/afford|safe to spend|can i spend|can i buy/.test(text)) && parsedAmount) {
    plan.operation = "affordability";
    plan.amount = parsedAmount;
  } else if ((/best|safest|when|what day|which day/.test(text)) && parsedAmount) {
    plan.operation = "payment_timing";
    plan.amount = parsedAmount;
  }

  const quoted = String(question || "").match(/["“]([^"”]+)["”]/);
  if (quoted) plan.entity = quoted[1];
  if (plan.operation !== "unknown") {
    plan.confidence = 0.82;
    plan.clarificationQuestion = null;
  }
  plan.includeCompleted = plan.completion !== "open";
  return plan;
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function correctPlan(question, raw, previousPlan, data) {
  const text = String(question || "").toLowerCase();
  const fallback = localPlan(question, previousPlan, data);
  const plan = raw && typeof raw === "object" ? { ...fallback, ...raw } : fallback;
  plan.operation = normalizeEnum(plan.operation, ["balance_filter", "balance_extreme", "event_list", "event_aggregate", "period_compare", "payment_timing", "affordability", "summary", "unknown"], fallback.operation);
  plan.metric = normalizeEnum(plan.metric, ["ending_balance", "minimum_balance", "maximum_balance", "amount", "outflow", "income", "net", "balance"], fallback.metric);
  plan.flow = normalizeEnum(plan.flow, ["all", "outflow", "income", "transfer"], fallback.flow);
  plan.eventKind = normalizeEnum(plan.eventKind, ["all", "bill", "income", "funding", "sweep", "transfer", "adjustment"], fallback.eventKind);
  plan.comparator = plan.comparator == null ? null : normalizeEnum(plan.comparator, ["lt", "lte", "eq", "gte", "gt"], fallback.comparator);
  plan.aggregation = plan.aggregation == null ? null : normalizeEnum(plan.aggregation, ["sum", "average", "count", "minimum", "maximum"], fallback.aggregation);
  plan.groupBy = plan.groupBy == null ? null : normalizeEnum(plan.groupBy, ["day", "month", "name", "type"], fallback.groupBy);
  plan.sort = normalizeEnum(plan.sort, ["date_asc", "date_desc", "amount_asc", "amount_desc", "value_asc", "value_desc"], fallback.sort);
  plan.limit = Math.min(30, Math.max(1, Number(plan.limit || fallback.limit || 12)));
  plan.threshold = plan.threshold == null || !Number.isFinite(Number(plan.threshold)) ? fallback.threshold : Number(plan.threshold);
  plan.amountComparator = plan.amountComparator == null ? fallback.amountComparator : normalizeEnum(plan.amountComparator, ["lt", "lte", "eq", "gte", "gt"], fallback.amountComparator);
  plan.amountThreshold = plan.amountThreshold == null || !Number.isFinite(Number(plan.amountThreshold)) ? fallback.amountThreshold : Math.abs(Number(plan.amountThreshold));
  plan.amount = plan.amount == null || !Number.isFinite(Number(plan.amount)) ? fallback.amount : Number(plan.amount);
  plan.entity = plan.entity ? String(plan.entity).slice(0, 120) : null;
  if (plan.entity && /^(?:all\s+)?(?:funding transfers?|sweeps?|transfers?|bills?|payments?|expenses?|income|paychecks?|deposits?|adjustments?)$/i.test(plan.entity.trim())) plan.entity = null;
  plan.completion = normalizeEnum(plan.completion, ["all", "open", "completed"], fallback.completion);
  plan.includeCompleted = plan.completion !== "open";
  plan.requiresConfirmation = !!plan.requiresConfirmation;
  plan.confidence = Math.max(0, Math.min(1, Number(plan.confidence || fallback.confidence || 0.5)));
  if (!validIso(plan.dateStart) || !validIso(plan.dateEnd) || plan.dateStart > plan.dateEnd) {
    plan.dateStart = fallback.dateStart;
    plan.dateEnd = fallback.dateEnd;
    plan.scopeLabel = fallback.scopeLabel;
  }
  if (plan.operation === "summary" && !summaryRequested(text)) plan.operation = fallback.operation;
  if (fallback.eventKind !== "all" && plan.eventKind === "all") plan.eventKind = fallback.eventKind;
  if (fallback.flow !== "all" && plan.flow === "all") plan.flow = fallback.flow;
  if (fallback.entity && !plan.entity) plan.entity = fallback.entity;
  if (fallback.amountComparator && !plan.amountComparator) {
    plan.amountComparator = fallback.amountComparator;
    plan.amountThreshold = fallback.amountThreshold;
  }
  if (plan.operation === "unknown") {
    plan.confidence = Math.min(plan.confidence, 0.4);
    plan.clarificationQuestion = plan.clarificationQuestion || fallback.clarificationQuestion;
  }
  return plan;
}

async function parsePlanWithOpenAI(question, data, previousPlan) {
  if (!OPENAI_API_KEY) return { mode: "local", plan: localPlan(question, previousPlan, data) };
  const payload = await openAIResponse({
    model: OPENAI_MODEL,
    max_output_tokens: 500,
    instructions: [
      "Translate a household-budget question into one general BillsOS query plan. Return strict JSON only.",
      "Do not calculate any values. BillsOS calculates after parsing.",
      "Use planning year 2026 unless another year is explicit. Available data is 2026-06 through 2026-12.",
      "Build plans compositionally from date range, event kind, entity, completion state, amount condition, calculation, grouping, and sorting. Do not rely on a small menu of exact phrasings.",
      "Examples: negative/below zero/overdrawn => balance_filter lt 0; biggest bills => event_list bill amount_desc; funding transfer amounts => event_list funding; total funding => event_aggregate funding sum; compare months => period_compare.",
      "Use previousPlan only for follow-ups such as that month, those bills, or what about September.",
      "Schema keys: operation, metric, dateStart, dateEnd, scopeLabel, flow, eventKind, comparator, threshold, amountComparator, amountThreshold, aggregation, groupBy, sort, limit, entity, amount, completion, includeCompleted, requiresConfirmation, confidence, clarificationQuestion.",
      "Allowed operation: balance_filter, balance_extreme, event_list, event_aggregate, period_compare, payment_timing, affordability, summary, unknown.",
      "Allowed metric: ending_balance, minimum_balance, maximum_balance, amount, outflow, income, net, balance.",
      "Allowed flow: all, outflow, income, transfer. Allowed comparator: lt, lte, eq, gte, gt. Allowed aggregation: sum, average, count, minimum, maximum. Allowed groupBy: day, month, name, type.",
      "Allowed eventKind: all, bill, income, funding, sweep, transfer, adjustment. Transfer means all transfer kinds; funding and sweep are specific kinds. Allowed completion: all, open, completed.",
      "Use summary only when the user explicitly asks for a summary, overview, recap, or snapshot. Otherwise prefer a usable best-match plan over unknown. Ask one focused clarification when a safe plan is not possible."
    ].join("\n"),
    input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify({ currentDate: cashflow.today(), userQuestion: question, previousPlan: previousPlan || null, billsContext: compactBillsContext(data) }) }] }]
  });
  return { mode: "openai", plan: correctPlan(question, extractJson(outputText(payload)), previousPlan, data) };
}

function registerAssistantApi(app, options) {
  const readBillsData = options && options.readBillsData;

  app.use((req, res, next) => {
    if (req.path !== "/" && req.path !== "/generated") return next();
    const originalSend = res.send.bind(res);
    res.send = body => originalSend(injectBridge(body));
    next();
  });

  app.get("/api/assistant/status", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ configured: !!OPENAI_API_KEY, model: OPENAI_MODEL, engine: cashflow.BUILD, intent: INTENT_BUILD });
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
      const previousPlan = req.body && req.body.previousPlan && typeof req.body.previousPlan === "object" ? req.body.previousPlan : null;
      if (!question) return res.status(400).json({ error: "Question is required" });
      const data = typeof readBillsData === "function" ? readBillsData() : {};
      const parsed = await parsePlanWithOpenAI(question, data, previousPlan).catch(err => ({ mode: "local", error: err && err.message ? err.message : "Plan parse failed", plan: localPlan(question, previousPlan, data) }));
      res.json({ mode: parsed.mode, model: parsed.mode === "openai" ? OPENAI_MODEL : null, build: INTENT_BUILD, intent: correctPlan(question, parsed.plan || localPlan(question, previousPlan, data), previousPlan, data), answer: null, error: parsed.error || null });
    } catch (err) {
      res.status(500).json({ error: err && err.message ? err.message : "Intent request failed" });
    }
  });

  app.post("/api/assistant", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const question = String((req.body && req.body.question) || "").trim().slice(0, 1000);
      const deterministicAnswer = plainText((req.body && req.body.deterministicAnswer) || "").slice(0, 5000);
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
}

module.exports = registerAssistantApi;
module.exports._test = { answerPreservesFacts, correctPlan, eventKindFromText, localPlan, normalizedDateFacts, normalizedMoneyFacts };
