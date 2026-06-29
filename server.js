const express = require("express");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const app = express();

const USER = process.env.BILLS_USER || "ryan";
const PASS = process.env.BILLS_PASS || "";
const SECRET = process.env.SESSION_SECRET || PASS || "change-me";
const DATA_DIR = process.env.BILLS_DATA_DIR || path.join(__dirname, "data");
const CHECKMARK_FILE = path.join(DATA_DIR, "checkmarks.json");
const BILLS_FILE = path.join(DATA_DIR, "bills.json");

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "2mb" }));

function makeToken() {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${USER}:${PASS}`)
    .digest("hex");
}

function getCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map(cookie => {
        const [key, ...value] = cookie.trim().split("=");
        return [key, decodeURIComponent(value.join("="))];
      })
  );
}

function isLoggedIn(req) {
  const cookies = getCookies(req);
  return cookies.billsos_auth === makeToken();
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile(filePath, fallback) {
  try {
    ensureDataDir();
    if (!fs.existsSync(filePath)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_err) {
    return fallback;
  }
}

function writeJsonFile(filePath, payload) {
  ensureDataDir();
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
  fs.renameSync(tmp, filePath);
  return payload;
}

function readCheckmarks() {
  const parsed = readJsonFile(CHECKMARK_FILE, { completed: {}, updatedAt: null });
  return {
    completed: parsed && typeof parsed.completed === "object" && !Array.isArray(parsed.completed) ? parsed.completed : {},
    updatedAt: parsed.updatedAt || null
  };
}

function writeCheckmarks(completed) {
  const clean = {};
  Object.keys(completed || {}).forEach(key => {
    if (completed[key]) clean[key] = 1;
  });
  return writeJsonFile(CHECKMARK_FILE, { completed: clean, updatedAt: new Date().toISOString() });
}

function normalizeBillsData(input) {
  const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    bills: Array.isArray(src.bills) ? src.bills : [],
    oneTimeEvents: Array.isArray(src.oneTimeEvents) ? src.oneTimeEvents : [],
    income: Array.isArray(src.income) ? src.income : [],
    updatedAt: src.updatedAt || null
  };
}

function readBillsData() {
  return normalizeBillsData(readJsonFile(BILLS_FILE, { bills: [], oneTimeEvents: [], income: [], updatedAt: null }));
}

function writeBillsData(data) {
  const clean = normalizeBillsData(data);
  clean.updatedAt = new Date().toISOString();
  return writeJsonFile(BILLS_FILE, clean);
}

function generatedDashboardHtml() {
  const generatedPath = path.join(__dirname, "generated-v5.html");
  let html = fs.readFileSync(generatedPath, "utf8");

  html = html.replace(
    "return e.name+' — '+money(Math.abs(e.amount))+' — '+friendlyDate(e.date)",
    "return JSON.stringify({alert:e.date+' 09:00',title:e.name,amount:money(Math.abs(e.amount))})"
  );
  html = html.replace(
    "items.length+' reminder(s) ready with 9 AM alert time.'",
    "items.length+' JSON reminder(s) ready.'"
  );

  return html;
}

function loginPage(error = "") {
  return `
<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BillsOS Login</title>
<style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: white; min-height: 100vh; display: grid; place-items: center; }
    .card { width: min(92vw, 380px); background: #111827; border: 1px solid #334155; border-radius: 18px; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
    h1 { margin: 0 0 8px; font-size: 24px; }
    p { margin: 0 0 18px; color: #cbd5e1; }
    label { display: block; margin: 14px 0 6px; color: #cbd5e1; }
    input { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 10px; border: 1px solid #475569; background: #020617; color: white; font-size: 16px; }
    button { width: 100%; margin-top: 18px; padding: 12px; border: 0; border-radius: 10px; background: #38bdf8; color: #082f49; font-weight: 700; font-size: 16px; }
    .error { margin-top: 12px; color: #fecaca; font-size: 14px; }
</style>
</head>
<body>
<form class="card" method="POST" action="/login">
<h1>BillsOS</h1>
<p>Sign in to view the dashboard.</p>
<label>Username</label>
<input name="username" autocomplete="username" required>
<label>Password</label>
<input name="password" type="password" autocomplete="current-password" required>
<button type="submit">Sign in</button>
    ${error ? `<div class="error">${error}</div>` : ""}
</form>
</body>
</html>
`;
}

app.get("/login", (req, res) => {
  if (!PASS) return res.status(500).send("BILLS_PASS is not set on Render.");
  res.send(loginPage());
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === USER && password === PASS) {
    res.setHeader("Set-Cookie", `billsos_auth=${makeToken()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
    return res.redirect("/");
  }
  res.status(401).send(loginPage("Invalid username or password."));
});

app.get("/logout", (req, res) => {
  res.setHeader("Set-Cookie", "billsos_auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  res.redirect("/login");
});

app.use((req, res, next) => {
  if (req.path === "/login") return next();
  if (isLoggedIn(req)) return next();
  return res.redirect("/login");
});

app.get("/api/checkmarks", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(readCheckmarks());
});

app.post("/api/checkmarks", (req, res) => {
  try {
    const completed = req.body && req.body.completed;
    if (!completed || typeof completed !== "object" || Array.isArray(completed)) {
      return res.status(400).json({ error: "Expected { completed: object }" });
    }
    res.json(writeCheckmarks(completed));
  } catch (_err) {
    res.status(500).json({ error: "Could not save checkmarks" });
  }
});

app.get("/api/bills", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(readBillsData());
});

app.post("/api/bills", (req, res) => {
  try {
    res.json(writeBillsData(req.body));
  } catch (_err) {
    res.status(500).json({ error: "Could not save bills control data" });
  }
});

app.get("/generated", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.send(generatedDashboardHtml());
});

app.get("/legacy", (_req, res) => {
  try {
    const indexPath = path.join(__dirname, "index.html");
    let html = fs.readFileSync(indexPath, "utf8");
    const syncScript = '<script defer src="/cloud-sync.js?v=20260626cloud2"></script>';
    if (!html.includes("/cloud-sync.js")) html = html.replace("</body>", `${syncScript}\n</body>`);
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  } catch (_err) {
    res.sendFile(path.join(__dirname, "index.html"));
  }
});

app.get("/control", (_req, res) => {
  try {
    const controlPath = path.join(__dirname, "control.html");
    let html = fs.readFileSync(controlPath, "utf8");
    const themeLink = '<link rel="stylesheet" href="/control-theme.css?v=20260627controltheme1">';
    const previewScript = '<script defer src="/control-preview.js?v=20260627paymethod1"></script>';
    if (!html.includes("/control-theme.css")) html = html.replace("</head>", `${themeLink}\n</head>`);
    if (!html.includes("/control-preview.js")) html = html.replace("</body>", `${previewScript}\n</body>`);
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  } catch (_err) {
    res.sendFile(path.join(__dirname, "control.html"));
  }
});

app.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.send(generatedDashboardHtml());
});

app.use(express.static(__dirname));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`BillsOS running on port ${port}`);
});
