'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createAccessControl } = require('../access-control');

const env = {
  BILLS_OWNER_USERNAME: 'owner',
  BILLS_OWNER_PASSWORD: 'owner-secret',
  BILLS_VIEWER_USERNAME: 'viewer',
  BILLS_VIEWER_PASSWORD: 'viewer-secret',
  BILLS_SESSION_SECRET: 'test-session-secret-that-is-not-committed'
};

test('Viewer GET requests and Assistant queries are allowed', () => {
  const access = createAccessControl(env);
  const viewer = access.readSession(access.createSession(access.authenticate('viewer', 'viewer-secret')));
  assert.deepEqual(access.requestAccessDecision(viewer, 'GET', '/api/bills'), { allowed: true });
  assert.deepEqual(access.requestAccessDecision(viewer, 'GET', '/'), { allowed: true });
  assert.deepEqual(access.requestAccessDecision(viewer, 'POST', '/api/assistant/intent'), { allowed: true });
});

test('Viewer writes are 403 while Owner writes are allowed', () => {
  const access = createAccessControl(env);
  const viewer = access.readSession(access.createSession(access.authenticate('viewer', 'viewer-secret')));
  const owner = access.readSession(access.createSession(access.authenticate('owner', 'owner-secret')));
  assert.equal(access.requestAccessDecision(viewer, 'POST', '/api/bills').status, 403);
  assert.equal(access.requestAccessDecision(viewer, 'POST', '/api/checkmarks').status, 403);
  assert.equal(access.requestAccessDecision(viewer, 'PATCH', '/api/bills/calendar-state').status, 403);
  assert.deepEqual(access.requestAccessDecision(owner, 'POST', '/api/bills'), { allowed: true });
  assert.deepEqual(access.requestAccessDecision(owner, 'PATCH', '/api/bills/calendar-state'), { allowed: true });
});

test('Viewer sync cannot mutate server state', () => {
  const access = createAccessControl(env);
  const viewer = access.readSession(access.createSession(access.authenticate('viewer', 'viewer-secret')));
  const serverState = { revision: 12, completed: { existing: 1 } };
  const before = structuredClone(serverState);
  const decision = access.requestAccessDecision(viewer, 'PATCH', '/api/bills/calendar-state');
  if (decision.allowed) Object.assign(serverState, { revision: 13, completed: { viewerWrite: 1 } });
  assert.equal(decision.status, 403);
  assert.deepEqual(serverState, before);
});

test('legacy Owner credentials keep BillsOS accessible while Viewer is not configured', () => {
  const access = createAccessControl({ BILLS_USER: 'ryan', BILLS_PASS: 'legacy-owner-secret' });
  assert.equal(access.ready, true);
  assert.equal(access.viewer.enabled, false);
  const owner = access.authenticate('ryan', 'legacy-owner-secret');
  assert.equal(owner.role, 'owner');
  const session = access.readSession(access.createSession(owner));
  assert.equal(session.role, 'owner');
  assert.equal(access.authenticate('viewer', ''), null);
});

test('missing Owner password leaves access control in a safe setup state', () => {
  const access = createAccessControl({});
  assert.equal(access.ready, false);
  assert.ok(access.missing.some(name => name.includes('BILLS_OWNER_PASSWORD')));
  assert.equal(access.authenticate('ryan', ''), null);
});

test('server installs the mutation gate before state-changing routes and injects versioned Viewer UI', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'access-control-ui.js'), 'utf8');
  const gate = server.indexOf('access.requestAccessDecision');
  assert.ok(gate > -1);
  assert.ok(gate < server.indexOf('app.post("/api/checkmarks"'));
  assert.ok(gate < server.indexOf('app.post("/api/bills"'));
  assert.ok(gate < server.indexOf('app.patch("/api/bills/calendar-state"'));
  assert.match(server, /access-control-ui\.js\?v=20260827owner-viewer1/);
  assert.match(ui, /billsosCardEditBtn/);
  assert.match(ui, /billsosCardDeleteBtn/);
  assert.match(ui, /billsosBalanceTarget/);
  assert.match(ui, /method !== 'GET'/);
  assert.match(ui, /status: 403/);
});
