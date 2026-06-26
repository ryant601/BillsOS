const express = require("express");

const path = require("path");

const app = express();

const USER = process.env.BILLS_USER || "ryan";

const PASS = process.env.BILLS_PASS || "";

function requireAuth(req, res, next) {

  if (!PASS) {

    return res

      .status(500)

      .send("BILLS_PASS is not set on the server.");

  }

  const header = req.headers.authorization || "";

  const [scheme, encoded] = header.split(" ");

  if (scheme !== "Basic" || !encoded) {

    res.set("WWW-Authenticate", 'Basic realm="BillsOS"');

    return res.status(401).send("Authentication required.");

  }

  const [user, pass] = Buffer.from(encoded, "base64")

    .toString("utf8")

    .split(":");

  if (user === USER && pass === PASS) {

    return next();

  }

  res.set("WWW-Authenticate", 'Basic realm="BillsOS"');

  return res.status(401).send("Invalid credentials.");

}

app.use(requireAuth);

app.get("/", (_req, res) => {

  res.sendFile(path.join(__dirname, "index.html"));

});

app.use(express.static(__dirname));

const port = process.env.PORT || 3000;

app.listen(port, () => {

  console.log(`BillsOS running on port ${port}`);

});
 
