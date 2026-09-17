'use strict';

const fs = require('fs');
const path = require('path');
const classifications = require('./spending-classification-rules');

const SCHEMA_VERSION = 1;

function cents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw Object.assign(new Error('Transaction amount must be a number'), { status: 400 });
  return Math.round(amount * 100);
}

function cleanText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function cleanEmoji(value) {
  const emoji = cleanText(value);
  return emoji && [...emoji].length <= 8 ? emoji : null;
}

function parseSnapshotTransactions(html) {
  const source = String(html || '');
  let rows = null;
  try {
    const current = JSON.parse(source);
    if (current && Array.isArray(current.transactions)) rows = current.transactions;
  } catch (_err) {}
  if (!rows) {
    const match = source.match(/const T=(\[[\s\S]*?\]);const M=/);
    if (match) rows = JSON.parse(match[1]);
  }
  if (!rows) throw Object.assign(new Error('Everyday Spending snapshot is unavailable'), { status: 503 });
  if (!Array.isArray(rows)) throw Object.assign(new Error('Everyday Spending snapshot is invalid'), { status: 503 });
  return rows.map(row => ({
    date: cleanText(row.date),
    merchant: cleanText(row.m),
    amount: Number(row.a),
    pending: row.p === true,
    category: cleanText(row.c),
    subcategory: cleanText(row.s),
    note: cleanText(row.n)
  }));
}

function stableMatch(row) {
  return `${row.date}|${row.merchant}|${cents(row.amount)}`;
}

function transactionIdentity(rows, row) {
  const matches = rows.filter(candidate => stableMatch(candidate) === stableMatch(row));
  const index = matches.indexOf(row);
  return {
    date: row.date,
    merchant: row.merchant,
    amount: row.amount,
    occurrence: index + 1,
    confirmedPending: row.pending,
    confirmedNote: row.note
  };
}

function overrideId(identity) {
  return Buffer.from(`${identity.date}|${identity.merchant}|${cents(identity.amount)}|${identity.occurrence}`, 'utf8').toString('base64url');
}

function categoryKey(category, subcategory) {
  return `${cleanText(category)}|${cleanText(subcategory)}`;
}

function cleanCategories(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.map(item => ({
    category: cleanText(item && item.category),
    subcategory: cleanText(item && item.subcategory),
    emoji: cleanEmoji(item && item.emoji),
    createdAt: cleanText(item && item.createdAt) || null,
    createdBy: cleanText(item && item.createdBy) || null
  })).filter(item => {
    if (!item.category || !item.subcategory) return false;
    const key = categoryKey(item.category, item.subcategory);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, overrides: [], categories: [], history: [], updatedAt: null };
}

function createSpendingCategoryStore(options = {}) {
  const dataDir = options.dataDir;
  const snapshotPath = options.snapshotPath;
  const classificationRulesPath = options.classificationRulesPath || null;
  const filePath = options.filePath || path.join(dataDir, 'spending-category-overrides.json');

  function readState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed && parsed.schemaVersion === SCHEMA_VERSION && Array.isArray(parsed.overrides)) {
        return {
          ...emptyState(),
          ...parsed,
          categories: cleanCategories(parsed.categories),
          history: Array.isArray(parsed.history) ? parsed.history : []
        };
      }
    } catch (_err) {}
    return emptyState();
  }

  function writeState(state) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
    fs.renameSync(tmp, filePath);
    return state;
  }

  function snapshotRows() {
    return parseSnapshotTransactions(fs.readFileSync(snapshotPath, 'utf8'));
  }

  function validCategoryPairs(rows) {
    const pairs = new Set(rows.map(row => categoryKey(row.category, row.subcategory)));
    if (!classificationRulesPath) return pairs;
    try {
      const rules = JSON.parse(fs.readFileSync(classificationRulesPath, 'utf8'));
      classifications.apply(rows, rules).forEach(row => pairs.add(categoryKey(row.category, row.subcategory)));
    } catch (_err) {}
    return pairs;
  }

  function publicState() {
    const state = readState();
    return {
      schemaVersion: state.schemaVersion,
      overrides: state.overrides,
      categories: state.categories,
      history: state.history.slice(-20),
      updatedAt: state.updatedAt
    };
  }

  function save(input, username) {
    const request = input && typeof input === 'object' ? input : {};
    const tx = request.transaction && typeof request.transaction === 'object' ? request.transaction : {};
    const requested = {
      date: cleanText(tx.date), merchant: cleanText(tx.merchant), amount: Number(tx.amount),
      pending: tx.pending === true, note: cleanText(tx.note), occurrence: Number(tx.occurrence)
    };
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(requested.date) || !requested.merchant || !Number.isFinite(requested.amount)) {
      throw Object.assign(new Error('An exact date, merchant, and amount are required'), { status: 400 });
    }
    const rows = snapshotRows();
    const stable = rows.filter(row => row.date === requested.date && row.merchant === requested.merchant && cents(row.amount) === cents(requested.amount));
    const hasOccurrence = Number.isInteger(requested.occurrence) && requested.occurrence > 0;
    const exact = hasOccurrence
      ? [stable[requested.occurrence - 1]].filter(row => row && row.pending === requested.pending && row.note === requested.note)
      : stable.filter(row => row.pending === requested.pending && row.note === requested.note);
    if (exact.length !== 1) {
      const ambiguous = !hasOccurrence && exact.length > 1;
      throw Object.assign(new Error(ambiguous ? 'More than one transaction matches; no change was saved' : 'The exact transaction is no longer in the current report'), { status: 409 });
    }

    const category = cleanText(request.category);
    const subcategory = cleanText(request.subcategory);
    if (!category || !subcategory) throw Object.assign(new Error('A category and subcategory are required'), { status: 400 });
    if (category.length > 60 || subcategory.length > 60) throw Object.assign(new Error('Category names must be 60 characters or fewer'), { status: 400 });

    const state = readState();
    const requestedKey = categoryKey(category, subcategory);
    const builtInPair = validCategoryPairs(rows).has(requestedKey);
    const savedPair = state.categories.some(item => categoryKey(item.category, item.subcategory) === requestedKey);
    if (!builtInPair && !savedPair && request.createCategory !== true) {
      throw Object.assign(new Error('Choose an existing BillsOS category and subcategory, or create a new one'), { status: 400 });
    }

    const now = new Date().toISOString();
    const by = cleanText(username) || 'owner';
    if (!builtInPair && !savedPair && request.createCategory === true) {
      const emoji = cleanEmoji(request.emoji);
      state.categories.push({ category, subcategory, emoji, createdAt: now, createdBy: by });
      state.history.push({ action: 'category-created', at: now, by, category, subcategory, emoji });
    }

    const identity = transactionIdentity(rows, exact[0]);
    const id = overrideId(identity);
    const previous = state.overrides.find(item => item.id === id) || null;
    const saved = {
      id, match: identity, category, subcategory,
      originalCategory: previous ? previous.originalCategory : exact[0].category,
      originalSubcategory: previous ? previous.originalSubcategory : exact[0].subcategory,
      updatedAt: now, updatedBy: by
    };
    state.overrides = state.overrides.filter(item => item.id !== id).concat(saved);
    state.history.push({ action: previous ? 'updated' : 'created', at: now, by: saved.updatedBy, override: saved });
    state.history = state.history.slice(-200);
    state.updatedAt = now;
    writeState(state);
    return saved;
  }

  function remove(id, username) {
    const state = readState();
    const found = state.overrides.find(item => item.id === id);
    if (!found) throw Object.assign(new Error('That category override no longer exists'), { status: 404 });
    const now = new Date().toISOString();
    state.overrides = state.overrides.filter(item => item.id !== id);
    state.history.push({ action: 'removed', at: now, by: cleanText(username) || 'owner', override: found });
    state.history = state.history.slice(-200);
    state.updatedAt = now;
    writeState(state);
    return found;
  }

  return { publicState, save, remove, filePath };
}

module.exports = { SCHEMA_VERSION, createSpendingCategoryStore, parseSnapshotTransactions, stableMatch, overrideId };
