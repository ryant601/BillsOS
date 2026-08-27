"use strict";

const crypto = require("crypto");

const COOKIE_NAME = "billsos_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const VIEWER_POST_PATHS = new Set(["/api/assistant", "/api/assistant/intent"]);

function firstValue(...values) {
  return values.find(value => typeof value === "string" && value.length) || "";
}

function timingSafeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(header) {
  return Object.fromEntries(
    String(header || "")
      .split(";")
      .filter(Boolean)
      .map(cookie => {
        const [key, ...value] = cookie.trim().split("=");
        try { return [key, decodeURIComponent(value.join("="))]; }
        catch (_err) { return [key, ""]; }
      })
  );
}

function createAccessControl(env = process.env) {
  const owner = {
    role: "owner",
    username: firstValue(env.BILLS_OWNER_USERNAME, env.BILLS_USER, "ryan"),
    password: firstValue(env.BILLS_OWNER_PASSWORD, env.BILLS_PASS),
    enabled: true
  };
  const viewer = {
    role: "viewer",
    username: firstValue(env.BILLS_VIEWER_USERNAME, env.BILLS_TEMP_USER, "viewer"),
    password: firstValue(env.BILLS_VIEWER_PASSWORD, env.BILLS_TEMP_PASS),
    enabled: !!firstValue(env.BILLS_VIEWER_PASSWORD, env.BILLS_TEMP_PASS)
  };

  // Prefer a dedicated session secret, but preserve the pre-role BillsOS setup by
  // falling back to the existing Owner password until Railway is updated.
  const secret = firstValue(env.BILLS_SESSION_SECRET, env.SESSION_SECRET, owner.password);
  const missing = [];
  if (!owner.password) missing.push("BILLS_OWNER_PASSWORD (or legacy BILLS_PASS)");
  if (!secret) missing.push("BILLS_SESSION_SECRET (or legacy SESSION_SECRET)");
  if (viewer.enabled && owner.username === viewer.username) missing.push("distinct Owner and Viewer usernames");

  function credentialTag(account) {
    return crypto.createHash("sha256").update(account.password).digest("hex").slice(0, 20);
  }

  function sign(encoded) {
    return crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  }

  function createSession(account, now = Date.now()) {
    if (!account || account.enabled === false || missing.length) return "";
    const payload = Buffer.from(JSON.stringify({
      role: account.role,
      username: account.username,
      credentialTag: credentialTag(account),
      expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000
    })).toString("base64url");
    return `${payload}.${sign(payload)}`;
  }

  function readSession(token, now = Date.now()) {
    if (!token || missing.length) return null;
    const [payload, signature, extra] = String(token).split(".");
    if (!payload || !signature || extra || !timingSafeEqual(signature, sign(payload))) return null;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      const account = parsed.role === "owner" ? owner : parsed.role === "viewer" ? viewer : null;
      if (!account || account.enabled === false || parsed.username !== account.username || parsed.credentialTag !== credentialTag(account)) return null;
      if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= now) return null;
      return { role: account.role, username: account.username, expiresAt: parsed.expiresAt };
    } catch (_err) {
      return null;
    }
  }

  function authenticate(username, password) {
    if (missing.length) return null;
    const accounts = viewer.enabled ? [owner, viewer] : [owner];
    return accounts.find(account => timingSafeEqual(username, account.username) && timingSafeEqual(password, account.password)) || null;
  }

  function sessionFromRequest(req) {
    return readSession(parseCookies(req && req.headers && req.headers.cookie)[COOKIE_NAME]);
  }

  function requestAccessDecision(session, method, requestPath) {
    const normalizedMethod = String(method || "GET").toUpperCase();
    if (!session) return { allowed: false, status: 401, error: "Authentication required" };
    if (SAFE_METHODS.has(normalizedMethod)) return { allowed: true };
    if (session.role === "owner") return { allowed: true };
    if (session.role === "viewer" && normalizedMethod === "POST" && VIEWER_POST_PATHS.has(requestPath)) return { allowed: true };
    return { allowed: false, status: 403, error: "View only access cannot make changes" };
  }

  return {
    COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    owner,
    viewer,
    missing,
    ready: missing.length === 0,
    authenticate,
    createSession,
    readSession,
    sessionFromRequest,
    requestAccessDecision
  };
}

module.exports = { COOKIE_NAME, SESSION_MAX_AGE_SECONDS, createAccessControl, parseCookies };
