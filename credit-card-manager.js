'use strict';
const crypto = require('crypto');
const engine = require('./cashflow-engine');
const calendar = require('./calendar-list-view');
const isCard = name => /^(amex|american express|citi\b|capital one\b|discover\b|apple card\b|macy|firestone\b|paypal credit)/i.test(name || '');
const cents = n => Math.round(Number(n) * 100);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
function state(data) { try { const rules = JSON.parse((data.oneTimeEvents || []).find(x => x.id === '__billsos_system_rules__')?.notes || '{}'); return rules.calendarState || rules; } catch (_) { throw new Error('Calendar settings could not be read'); } }
function matching(map, key) {
  if (map?.[key]) return map[key];
  const identity = k => { const p = k.split('|'); return p.slice(1, -1).join('|') + '|' + Number(p.at(-1)); };
  const keys = Object.keys(map || {}).filter(k => identity(k) === identity(key) && String(map[k].originalDate || k).slice(0, 7) === key.slice(0, 7));
  keys.sort((a, b) => (Date.parse(map[b].updatedAt) || 0) - (Date.parse(map[a].updatedAt) || 0));
  return map?.[keys[0]];
}
function projection(data, extra) {
  const clean = { ...data, bills: (data.bills || []).filter(x => x.active !== false), income: (data.income || []).filter(x => x.active !== false) };
  const model = engine.build(clean, { floorNegative: false }), edits = state(data);
  const rows = Object.values(model.months).flatMap(m => m.rows).map(row => {
    const key = row.iso + '|' + row.name + '|' + row.amount, amount = matching(edits.amountAdjustments, key), date = matching(edits.dateAdjustments, key);
    const r = { ...row };
    if (amount && Number.isFinite(Number(amount.amount))) r.amount = (r.amount < 0 ? -1 : 1) * Math.abs(Number(amount.amount));
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date.date)) { r.iso = date.date; r.day = Number(date.date.slice(8)); }
    return r;
  });
  if (extra) rows.push({ iso: extra.date, day: Number(extra.date.slice(8)), amount: -extra.amount, name: 'Extra card payment' });
  let running = engine.FIRST_BEGIN, result = [];
  engine.MONTHS.forEach(m => {
    const key = m[3] + '-' + String(m[1]).padStart(2, '0');
    const summary = calendar.buildMonth(rows.filter(r => r.iso.slice(0, 7) === key), m[3], m[1], running, {});
    result.push(...summary.days); running = summary.days.at(-1).ending;
  });
  return result;
}
function discover(data, store, date = today()) {
  const cards = (store.cards || []).map(c => ({ ...c }));
  const seen = new Set(cards.map(c => c.sourceBillId));
  (data.bills || []).filter(b => b.active !== false && isCard(b.name) && (!b.startMonth || b.startMonth <= date.slice(0, 7)) && (!b.endMonth || b.endMonth >= date.slice(0, 7))).forEach(b => {
    const previous = cards.find(c => {
      const old = (data.bills || []).find(x => x.id === c.sourceBillId);
      return old && String(old.name).trim().toLowerCase() === String(b.name).trim().toLowerCase() && ((old.endMonth && b.startMonth && old.endMonth < b.startMonth) || (b.endMonth && old.startMonth && b.endMonth < old.startMonth));
    });
    if (previous && !seen.has(b.id)) { previous.sourceBillId = b.id; seen.add(b.id); return; }
    if (!seen.has(b.id)) { cards.push({ id: 'cc-' + b.id, sourceBillId: b.id, name: b.name, balance: null, apr: null, payment: Math.abs(Number(b.amount || 0)), limit: null, history: [], archived: false }); seen.add(b.id); }
  });
  return cards;
}
function validateCard(input, old, date = today()) {
  const name = String(input.name || '').trim();
  if (!name || name.length > 100) throw new Error('Enter a card name (100 characters or fewer)');
  const result = { ...old, name, archived: !!input.archived };
  for (const field of ['balance', 'apr', 'payment', 'limit']) {
    const v = input[field] === '' || input[field] == null ? null : Number(input[field]);
    if (v != null && (!Number.isFinite(v) || v < 0 || v > (field === 'apr' ? 100 : 10000000))) throw new Error('Enter a valid ' + field);
    result[field] = v == null ? null : (field === 'apr' ? v : cents(v) / 100);
  }
  const asOf = String(input.balanceAsOf || date);
  if (!validDate(asOf) || asOf > date) throw new Error('Balance date must be today or earlier');
  result.balanceAsOf = asOf;
  result.history = (old.history || []).slice();
  if (result.balance != null && (old.balance !== result.balance || old.balanceAsOf !== asOf)) result.history.push({ date: asOf, balance: result.balance, recordedAt: new Date().toISOString() });
  result.history = result.history.slice(-250);
  return result;
}
function quote(data, card, input, date = today()) {
  const amount = Number(input.amount), buffer = Number(input.buffer), start = String(input.start || date), end = String(input.end || engine.addDays(date, 30));
  if (!card || card.archived || card.balance == null || card.balance <= 0) throw new Error('Enter a current balance for an active card first');
  if (!Number.isFinite(amount) || cents(amount) <= 0 || cents(amount) > cents(card.balance)) throw new Error('Extra payment must be positive and no larger than the recorded balance');
  if (!Number.isFinite(buffer) || buffer < 0 || buffer > 1000000) throw new Error('Enter a valid cash buffer');
  if (!validDate(start) || !validDate(end) || start < date || end < start || end > '2027-12-31') throw new Error('Choose future dates within the calendar, through December 2027');
  const days = projection(data), available = days.filter(d => d.date >= start && d.date <= end);
  const options = available.map(d => {
    const after = projection(data, { date: d.date, amount: cents(amount) / 100 }).filter(x => x.date >= d.date);
    const low = after.reduce((a, b) => b.ending < a.ending ? b : a);
    return { date: d.date, amount: cents(amount) / 100, buffer, lowest: Math.round(low.ending * 100) / 100, lowestDate: low.date, before: d.ending, after: Math.round((d.ending - amount) * 100) / 100, safe: cents(low.ending) >= cents(buffer), through: days.at(-1).date };
  }).sort((a, b) => Number(b.safe) - Number(a.safe) || b.lowest - a.lowest || a.date.localeCompare(b.date));
  const safe = options.filter(o => o.safe);
  return { options: (safe.length ? safe : options).slice(0, 5), safe: safe.length > 0, checkedThrough: days.at(-1).date };
}
function register(app, deps) {
  const { readStore, writeStore, readBills, writeBills } = deps;
  const get = () => { const s = readStore(); return { revision: s.revision || 0, cards: discover(readBills(), s) }; };
  app.get('/api/credit-cards', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json(get()); });
  app.post('/api/credit-cards', (req, res) => {
    try {
      const s = get();
      if (req.body.revision !== s.revision) return res.status(409).json({ error: 'Cards changed on another device. Reload before saving.' });
      const existing = s.cards.find(c => c.id === req.body.card?.id);
      if (req.body.card?.id && !existing) throw new Error('Card no longer exists. Reload before saving.');
      const old = existing || { id: crypto.randomUUID(), history: [] };
      const card = validateCard(req.body.card || {}, old);
      s.cards = s.cards.filter(c => c.id !== card.id).concat(card); s.revision++;
      writeStore(s); res.json(s);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post('/api/credit-cards/preview', (req, res) => {
    try { const s = get(); res.json(quote(readBills(), s.cards.find(c => c.id === req.body.cardId), req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post('/api/credit-cards/payments', (req, res) => {
    try {
      const { cardId, date, amount, buffer, planId } = req.body;
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(planId || ''))) throw new Error('Invalid payment identifier');
      const data = readBills(), id = 'cc-extra-' + planId;
      if ((data.oneTimeEvents || []).some(e => e.id === id)) return res.json({ saved: true, duplicate: true });
      const card = get().cards.find(c => c.id === cardId);
      const result = quote(data, card, { amount, buffer, start: date, end: date });
      if (!result.safe) return res.status(409).json({ error: 'The latest calendar does not support this payment at your chosen buffer. Preview again.' });
      const planned = (data.oneTimeEvents || []).filter(e => e.creditCardId === cardId && e.date >= today()).reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);
      if (cents(planned + Number(amount)) > cents(card.balance)) throw new Error('Existing extra payments plus this payment exceed the recorded balance');
      data.oneTimeEvents.push({ id, name: card.name + ' — extra payment', date, amount: -cents(amount) / 100, type: 'adjustment', category: 'Credit Cards', payMethod: 'manual', creditCardId: cardId, notes: 'Additional debt payment. Planned in Credit Cards; update the card balance after it posts.' });
      const saved = writeBills(data); res.json({ saved: true, updatedAt: saved.updatedAt });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
}
module.exports = { register, projection, discover, validateCard, quote, matching };
