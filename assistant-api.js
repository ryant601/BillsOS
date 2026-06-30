"use strict";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function compactBillsContext(data) {
  const src = data && typeof data === "object" ? data : {};
  const bills = Array.isArray(src.bills) ? src.bills : [];
  const income = Array.isArray(src.income) ? src.income : [];
  const oneTimeEvents = Array.isArray(src.oneTimeEvents) ? src.oneTimeEvents : [];
  return {
    updatedAt: src.updatedAt || null,
    bills: bills
      .filter(row => row && row.active !== false)
      .slice(0, 80)
      .map(row => ({
        name: row.name || "Bill",
        amount: Number(row.amount || 0),
        dueDay: row.dueDay || null,
        frequency: row.frequency || "monthly",
        startMonth: row.startMonth || null,
        endMonth: row.endMonth || null
      })),
    income: income
      .filter(row => row && row.active !== false)
      .slice(0, 20)
      .map(row => ({
        name: row.name || "Income",
        amount: Number(row.amount || 0),
        schedule: row.schedule || "manual"
      })),
    oneTimeEvents: oneTimeEvents
      .filter(row => row && row.id !== "__billsos_system_rules__")
      .slice(0, 60)
      .map(row => ({
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
    .replace(
      /push\(Math\.min\(dim,Math\.max\(1,base\+add\)\),'Spending account funding',-Math\.abs\(Number\(sp\.amount\)\),'out system','rule'\)/g,
      "var fundDay=Math.min(dim,Math.max(1,base+add)),fundAmt=safeSweepAmount(fundDay,sp.amount);if(fundAmt>0)push(fundDay,'Spending account funding',-fundAmt,'out system','rule')"
    )
    .replace(
      /push\(base,'Spending account funding',-Math\.abs\(Number\(sp\.amount\)\),'out system','rule'\)/g,
      "var fundDay=base,fundAmt=safeSweepAmount(fundDay,sp.amount);if(fundAmt>0)push(fundDay,'Spending account funding',-fundAmt,'out system','rule')"
    );
}

function injectBridge(html) {
  let out = normalizeDashboardProjection(html);
  if (typeof out !== "string") return out;
  const scripts = [
    '<script id="billsosAssistantUi" defer src="/assistant-ui.js?v=20260630assistant5"></script>',
    '<script id="billsosAssistantAiBridge" defer src="/assistant-ai-bridge.js?v=20260630bridge5"></script>'
  ].filter(script => !out.includes(script.match(/id="([^"]+)"/)[1])).join("\n");
  if (!scripts) return out;
  if (out.includes("</body>")) return out.replace("</body>", `${scripts}\n</body>`);
  return out + scripts;
}

async function callOpenAI({ question, deterministicAnswer, billsContext }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
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
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                userQuestion: question,
                deterministicBillsOSResult: deterministicAnswer,
                billsContext
              })
            }
          ]
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && payload.error && payload.error.message ? payload.error.message : `OpenAI HTTP ${response.status}`;
    throw new Error(message);
  }
  const answer = payload.output_text ||
    (Array.isArray(payload.output) ? payload.output.map(item => {
      if (!Array.isArray(item.content)) return "";
      return item.content.map(part => part.text || "").join(" ");
    }).join(" ").trim() : "");
  return answer || deterministicAnswer;
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
      assistant: "assistant-ui-20260630-5",
      bridge: "assistant-ai-bridge-20260630-5",
      projectionGuard: "enabled"
    });
  });

  app.post("/api/assistant", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const question = String((req.body && req.body.question) || "").trim().slice(0, 1000);
      const deterministicAnswer = plainText((req.body && req.body.deterministicAnswer) || "").slice(0, 4000);
      if (!question) return res.status(400).json({ error: "Question is required" });
      if (!deterministicAnswer) return res.status(400).json({ error: "Deterministic BillsOS result is required" });
      if (!OPENAI_API_KEY) {
        return res.status(501).json({
          mode: "local",
          enabled: false,
          error: "OPENAI_API_KEY is not configured"
        });
      }
      const billsContext = compactBillsContext(typeof readBillsData === "function" ? readBillsData() : {});
      const answer = await callOpenAI({ question, deterministicAnswer, billsContext });
      res.json({ mode: "openai", enabled: true, model: OPENAI_MODEL, answer });
    } catch (err) {
      res.status(500).json({
        mode: "local",
        enabled: !!OPENAI_API_KEY,
        error: err && err.message ? err.message : "Assistant request failed"
      });
    }
  });
};
