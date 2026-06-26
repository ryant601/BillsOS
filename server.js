const express = require("express");

const path = require("path");

const crypto = require("crypto");

const app = express();

const USER = process.env.BILLS_USER || "ryan";

const PASS = process.env.BILLS_PASS || "";

const SECRET = process.env.SESSION_SECRET || PASS || "change-me";

app.use(express.urlencoded({ extended: false }));

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

function loginPage(error = "") {

  return `
<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BillsOS Login</title>
<style>

    body {

      margin: 0;

      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

      background: #0f172a;

      color: white;

      min-height: 100vh;

      display: grid;

      place-items: center;

    }

    .card {

      width: min(92vw, 380px);

      background: #111827;

      border: 1px solid #334155;

      border-radius: 18px;

      padding: 24px;

      box-shadow: 0 20px 60px rgba(0,0,0,.35);

    }

    h1 { margin: 0 0 8px; font-size: 24px; }

    p { margin: 0 0 18px; color: #cbd5e1; }

    label { display: block; margin: 14px 0 6px; color: #cbd5e1; }

    input {

      width: 100%;

      box-sizing: border-box;

      padding: 12px;

      border-radius: 10px;

      border: 1px solid #475569;

      background: #020617;

      color: white;

      font-size: 16px;

    }

    button {

      width: 100%;

      margin-top: 18px;

      padding: 12px;

      border: 0;

      border-radius: 10px;

      background: #38bdf8;

      color: #082f49;

      font-weight: 700;

      font-size: 16px;

    }

    .error {

      margin-top: 12px;

      color: #fecaca;

      font-size: 14px;

    }
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

    res.setHeader(

      "Set-Cookie",

      `billsos_auth=${makeToken()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`

    );

    return res.redirect("/");

  }

  res.status(401).send(loginPage("Invalid username or password."));

});

app.get("/logout", (req, res) => {

  res.setHeader(

    "Set-Cookie",

    "billsos_auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"

  );

  res.redirect("/login");

});

app.use((req, res, next) => {

  if (req.path === "/login") return next();

  if (isLoggedIn(req)) return next();

  return res.redirect("/login");

});

app.get("/", (_req, res) => {

  res.sendFile(path.join(__dirname, "index.html"));

});

app.use(express.static(__dirname));

const port = process.env.PORT || 3000;

app.listen(port, () => {

  console.log(`BillsOS running on port ${port}`);

});
 
