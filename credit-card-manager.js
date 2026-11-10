'use strict';
const crypto = require('crypto');
const engine = require('./cashflow-engine');
const calendar = require('./calendar-list-view');
const isCard = name => /^(amex|american express|citi\b|capital one\b|discover\b|apple card\b|macy|firestone\b|paypal credit)/i.test(name || '');
const isPaymentPlan = card => typeof card?.paymentPlan === 'boolean' ? card.paymentPlan : /^(amex|american express)\b/i.test(card?.name || '');
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
    const r = { ...row, originalKey: key };
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
function discover(data, store, date = today(), options = {}) {
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
  return cards.map(card => {
    const active = (data.bills || []).filter(b => b.active !== false && (!b.startMonth || b.startMonth <= date.slice(0, 7)) && (!b.endMonth || b.endMonth >= date.slice(0, 7)));
    const named = active.filter(b => String(b.name || '').trim().toLowerCase() === String(card.name || '').trim().toLowerCase());
    const bill = card.sourceBillId ? active.find(b => b.id === card.sourceBillId) : (named.length === 1 ? named[0] : null);
    const dueDay = Number(bill?.dueDay);
    const paymentPlan = typeof card.paymentPlan === 'boolean' ? card.paymentPlan : !!options.legacyPaymentPlans && (isPaymentPlan(card) || isPaymentPlan(bill));
    return { ...card, paymentPlan, payment: paymentPlan && bill ? Math.abs(Number(bill.amount || 0)) : card.payment, dueDay: bill && (!bill.frequency || bill.frequency === 'monthly') && Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31 ? dueDay : null };
  });
}
function validateCard(input, old, date = today()) {
  const name = String(input.name || '').trim();
  if (!name || name.length > 100) throw new Error('Enter a card name (100 characters or fewer)');
  const result = { ...old, name, archived: !!input.archived };
  if (typeof input.paymentPlan === 'boolean') result.paymentPlan = input.paymentPlan;
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
function cardBillIds(data, card) {
  const bills = data.bills || [];
  const normalize = name => String(name || '').trim().toLowerCase();
  const linked = card.sourceBillId && bills.find(bill => bill.id === card.sourceBillId);
  return new Set(bills.filter(bill => {
    if (linked && bill.id === linked.id) return true;
    if (normalize(bill.name) !== normalize(linked?.name || card.name)) return false;
    return !linked || (bill.endMonth && linked.startMonth && bill.endMonth < linked.startMonth) ||
      (linked.endMonth && bill.startMonth && linked.endMonth < bill.startMonth);
  }).map(bill => bill.id));
}

// Estimates remain derived: a new confirmed balance always becomes the baseline.
function estimateBalances(data, cards, legacyDone = {}, asOf = today(), days = projection(data)) {
  const savedState = state(data), done = savedState.completed || legacyDone;
  const allRows = days.flatMap(d => d.items), sources = new Map((data.oneTimeEvents || []).map(e => [e.id, e]));
  const end = days.at(-1).date;
  return cards.map(card => {
    if (card.balance == null || card.apr == null || !validDate(card.balanceAsOf || '') || card.balanceAsOf < days[0].date || card.balanceAsOf > asOf || asOf > end) return { cardId: card.id, available: false };
    const ids = cardBillIds(data, card);
    const hasLinkedBill = card.sourceBillId && (data.bills || []).some(bill => bill.id === card.sourceBillId);
    const payments = allRows.filter(row => row.amount < 0 && row.iso > card.balanceAsOf &&
      (sources.get(row.sourceId)?.creditCardId === card.id || ids.has(row.sourceId) ||
       (!hasLinkedBill && String(row.name || '').trim().toLowerCase() === card.name.trim().toLowerCase())))
      .map(row => ({ date: row.iso, amount: cents(-row.amount), paid: !!done[row.originalKey] }));
    const byDate = new Map(); payments.forEach(p => { const a = byDate.get(p.date) || []; a.push(p); byDate.set(p.date, a); });
    let balance = cents(card.balance), current = balance, month = null;
    const months = [];
    for (let date = engine.addDays(card.balanceAsOf, 1); date <= end; date = engine.addDays(date, 1)) {
      const key = date.slice(0, 7);
      if (!month || month.month !== key) { month = { month: key, opening: balance / 100, interest: 0, paid: 0, planned: 0, ending: 0 }; months.push(month); }
      const interest = balance * card.apr / 36500;
      balance += interest; month.interest += interest / 100;
      for (const p of byDate.get(date) || []) {
        if (date > asOf || p.paid) {
          const amount = Math.min(balance, p.amount); balance -= amount;
          month[date <= asOf ? 'paid' : 'planned'] += amount / 100;
        }
      }
      month.ending = balance / 100;
      if (date <= asOf) current = balance;
    }
    const round = n => Math.round(n * 100) / 100;
    return { cardId: card.id, available: true, baseline: card.balance, baselineDate: card.balanceAsOf, asOf, current: round(current / 100), through: end, months: months.map(m => Object.fromEntries(Object.entries(m).map(([k,v]) => [k, typeof v === 'number' ? round(v) : v]))) };
  });
}
function quote(data, card, input, date = today()) {
  if (isPaymentPlan(card)) throw new Error('Fixed payment-plan cards are excluded from extra-payment planning');
  const amount = Number(input.amount), buffer = Number(input.buffer), start = String(input.start || date), end = String(input.end || engine.addDays(date, 30));
  if (!card || card.removed || card.archived || card.balance == null || card.balance <= 0) throw new Error('Enter a current balance for an active card first');
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
// Run payoff and cash projections on the same dated calendar rows.
function debtScenarios(data, cards, input, completed = {}, date = today()) {
  const lmccId = 'lmcc-dues-2027';
  const includeLmcc = input.includeLmcc === 'on' || input.includeLmcc === true;
  const lmccName = name => /\blmcc\b|lake mohawk.*dues/i.test(name || '') && !/\b2026\b|arrears|past due/i.test(name || '');
  const isDuesDay = day => day.date.startsWith('2027-');
  const actualDays = projection(data);
  const scheduledIds = new Set((includeLmcc ? actualDays.filter(isDuesDay) : []).flatMap(day =>
    day.items.filter(row => row.amount < 0 && lmccName(row.name) &&
      !(data.oneTimeEvents || []).some(event => event.id === row.sourceId && event.debtPlanId))
      .map(row => row.sourceId)));
  const lmccAssumed = includeLmcc && !scheduledIds.size;
  if (lmccAssumed) {
    const assumed = Array.from({length:12}, (_, month) => ({
      id: 'lmcc-preview-' + month, name: '2027 LMCC dues', type: 'adjustment', amount: -250,
      date: new Date(Date.UTC(2027, month + 1, 0)).toISOString().slice(0,10)
    }));
    assumed.forEach(event => scheduledIds.add(event.id));
    data = { ...data, oneTimeEvents: [...(data.oneTimeEvents || []), ...assumed] };
  }
  const currentDays = lmccAssumed ? projection(data) : actualDays, through = currentDays.at(-1).date;
  const start = String(input.start || date), months = Number(input.months);
  const planId = String(input.planId || 'preview');
  const extra = Number(input.extra), lump = Number(input.lump), buffer = Number(input.buffer);
  const bonus = cents(input.bonus || 0) / 100;
  if (!validDate(start) || start < date || start < currentDays[0].date || start > through ||
      !Number.isInteger(months) || months < 1 || months > 24 ||
      [extra, lump, buffer, bonus].some(value => !Number.isFinite(value) || value < 0 || value > 1000000)) {
    throw new Error('Enter valid amounts, a first payment date inside the calendar, and 1–24 months.');
  }
  const bonusEvent = bonus ? {
    id: 'cc-debt-' + planId + '-bonus', debtPlanId: planId, name: 'Expected bonus — debt plan ' + planId.slice(0, 8),
    date: start, amount: bonus, type: 'income', category: 'Income', notes: 'Expected net bonus from Debt Planner.'
  } : null;
  const scenarioData = bonusEvent ? { ...data, oneTimeEvents: [...(data.oneTimeEvents || []), bonusEvent] } : data;
  const days = bonusEvent ? projection(scenarioData) : currentDays;
  const paymentDates = new Map();
  for (let month = 0; month < months; month++) {
    const [year, monthNumber, day] = start.split('-').map(Number);
    const last = new Date(Date.UTC(year, monthNumber + month, 0)).getUTCDate();
    const iso = new Date(Date.UTC(year, monthNumber + month - 1, Math.min(day, last))).toISOString().slice(0, 10);
    if (iso > through && (cents(extra) || (!month && cents(lump)))) {
      throw new Error('Choose fewer months so all additional payments fit within the calendar through ' + through + '.');
    }
    paymentDates.set(iso, cents(extra) + (!month ? cents(lump) : 0));
  }

  const active = cards.filter(card => !card.removed && !card.archived && !isPaymentPlan(card));
  const estimates = new Map(estimateBalances(data, active, completed, date, days).filter(e => e.available).map(e => [e.cardId, e.current]));
  const modeled = active.filter(card => estimates.has(card.id) && estimates.get(card.id) > 0);
  const excluded = active.filter(card => !estimates.has(card.id)).map(card => card.name);
  const sources = new Map((data.oneTimeEvents || []).map(event => [event.id, event]));
  const linked = new Map();
  const unlinked = [];
  for (const card of modeled) {
    const ids = cardBillIds(data, card);
    if (!ids.size) unlinked.push(card.name);
    for (const id of ids) {
      if (linked.has(id)) throw new Error('Multiple cards match one scheduled bill. Update the card details before comparing.');
      linked.set(id, card.id);
    }
  }
  const done = state(data).completed || completed;
  if (includeLmcc) {
    const paid = days.filter(day => isDuesDay(day) && day.date <= date)
      .flatMap(day => day.items).filter(row => row.amount < 0 && done[row.originalKey] &&
        (scheduledIds.has(row.sourceId) || sources.get(row.sourceId)?.debtAccountId === lmccId))
      .reduce((total, row) => total + cents(-row.amount), 0);
    const balance = Math.max(0, 300000 - paid) / 100;
    if (balance) {
      modeled.push({id:lmccId, name:'2027 LMCC dues', apr:0, liability:true});
      estimates.set(lmccId, balance);
    }
  }
  const debtId = (row, day) => {
    const source = sources.get(row.sourceId);
    if (includeLmcc && isDuesDay(day) && (scheduledIds.has(row.sourceId) || source?.debtAccountId === lmccId)) return lmccId;
    return source?.creditCardId || linked.get(row.sourceId);
  };
  const future = days.filter(day => day.date >= date);
  const starting = modeled.reduce((sum, card) => sum + cents(estimates.get(card.id)), 0);

  const recurring = new Map((data.bills || []).filter(bill => bill.active !== false && (!bill.frequency || bill.frequency === 'monthly')).map(bill => [bill.id, bill]));
  const monthlyBill = new Map();
  for (const day of future) {
    if (day.date < start) continue;
    for (const row of day.items) {
      const cardId = linked.get(row.sourceId), bill = recurring.get(row.sourceId);
      if (cardId && bill && row.amount < 0) monthlyBill.set(cardId, Math.abs(Number(bill.amount)));
    }
  }

  if (includeLmcc && future.some(day => day.date > start && isDuesDay(day) &&
      day.items.some(row => row.amount < 0 && scheduledIds.has(row.sourceId)))) monthlyBill.set(lmccId, 250);

  function reliefTargets(debts, budget) {
    const candidates = debts.filter(debt => debt.remaining > 0 && monthlyBill.get(debt.id) && Math.ceil(debt.remaining) <= budget)
      .sort((a, b) => monthlyBill.get(b.id) / b.remaining - monthlyBill.get(a.id) / a.remaining);
    // The bounded exact search maximizes the total scheduled monthly payments cleared.
    if (candidates.length > 18) {
      let remaining = budget;
      return candidates.filter(debt => {
        const cost = Math.ceil(debt.remaining);
        if (cost > remaining) return false;
        remaining -= cost;
        return true;
      });
    }
    let best = [], bestRelief = 0, bestCost = 0;
    function search(index, cost, relief, picked) {
      if (relief > bestRelief || (relief === bestRelief && cost < bestCost)) {
        best = picked.slice(); bestRelief = relief; bestCost = cost;
      }
      for (let i = index; i < candidates.length; i++) {
        const debt = candidates[i], nextCost = cost + Math.ceil(debt.remaining);
        if (nextCost > budget) continue;
        picked.push(debt);
        search(i + 1, nextCost, relief + cents(monthlyBill.get(debt.id)), picked);
        picked.pop();
      }
    }
    search(0, 0, 0, []);
    return best;
  }

  function simulate(strategy) {
    const debts = modeled.map(card => ({ ...card, remaining: cents(estimates.get(card.id)), paidOn: null }));
    const byId = new Map(debts.map(debt => [debt.id, debt]));
    const payments = [], monthEnds = new Map();
    let interest = 0, payoffDate = null;
    for (const day of future) {
      for (const debt of debts) {
        const accrual = day.date === date ? 0 : debt.remaining * debt.apr / 36500;
        debt.remaining += accrual;
        interest += accrual;
      }
      for (const item of day.items) {
        if (item.amount >= 0 || (day.date === date && done[item.originalKey])) continue;
        const id = debtId(item, day);
        const debt = byId.get(id);
        if (debt) debt.remaining = Math.max(0, debt.remaining - cents(-item.amount));
      }

      let budget = strategy === 'baseline' ? 0 : paymentDates.get(day.date) || 0;
      const ranked = debts.filter(debt => debt.remaining > 0).sort((a, b) =>
        (strategy === 'snowball' ? a.remaining - b.remaining || b.apr - a.apr : b.apr - a.apr || a.remaining - b.remaining) ||
        a.id.localeCompare(b.id));
      const targets = strategy === 'relief' && budget ? reliefTargets(debts, budget) : [];
      const lmcc = byId.get(lmccId);
      if (strategy === 'lmcc' && lmcc?.remaining > 0 && Math.ceil(lmcc.remaining) <= budget) targets.push(lmcc);
      const priority = [...targets, ...ranked.filter(debt => !targets.includes(debt))];
      for (const debt of priority) {
        const amount = Math.min(budget, Math.ceil(debt.remaining));
        if (amount <= 0) break;
        debt.remaining = Math.max(0, debt.remaining - amount);
        budget -= amount;
        payments.push({ ...(debt.liability ? {debtAccountId:debt.id} : {cardId:debt.id}), name: debt.name, date: day.date, amount: amount / 100 });
      }
      for (const debt of debts) {
        if (!debt.remaining && !debt.paidOn) debt.paidOn = day.date;
      }
      const remaining = debts.reduce((sum, debt) => sum + debt.remaining, 0);
      if (debts.length && remaining === 0 && !payoffDate) payoffDate = day.date;
      monthEnds.set(day.date.slice(0, 7), { month: day.date.slice(0, 7), debt: Math.round(remaining) / 100 });
    }

    const after = payments.length ? projection({ ...scenarioData, oneTimeEvents: [
      ...(scenarioData.oneTimeEvents || []), ...payments.map((payment, index) => scenarioEvent(payment, planId, index))
    ] }) : days;
    const impactStart = payments[0]?.date || start;
    const projected = after.filter(day => day.date >= impactStart);
    const lowest = projected.reduce((a, b) => b.ending < a.ending ? b : a);
    const cash = new Map();
    for (const day of after.filter(day => day.date >= date)) {
      const month = day.date.slice(0, 7);
      const previous = cash.get(month);
      cash.set(month, { ending: day.ending, low: Math.min(previous?.low ?? Infinity, day.ending) });
    }
    const releases = new Map(), cashIfBillsStop = new Map();
    let releasedCash = 0;
    for (const day of after.filter(day => day.date >= date)) {
      if (day.items.some(row => row.type === 'balance-opening-adjustment' && row.requestedBalance != null)) releasedCash = 0;
      const month = day.date.slice(0, 7);
      for (const row of day.items) {
        const debt = byId.get(debtId(row, day));
        if (row.amount < 0 && (recurring.has(row.sourceId) || (includeLmcc && isDuesDay(day) && scheduledIds.has(row.sourceId))) && debt?.paidOn && day.date > debt.paidOn) {
          const released = cents(-row.amount);
          releases.set(month, (releases.get(month) || 0) + released);
          releasedCash += released;
        }
      }
      cashIfBillsStop.set(month, day.ending + releasedCash / 100);
    }
    const monthly = [...monthEnds.values()].map(row => ({
      ...row, ...cash.get(row.month), cashIfBillsStop: cashIfBillsStop.get(row.month), possibleRelief: (releases.get(row.month) || 0) / 100
    }));
    const clearedByExtras = debts.filter(debt => debt.paidOn && payments.some(payment => (payment.cardId || payment.debtAccountId) === debt.id && payment.date === debt.paidOn));
    const monthlyRelief = clearedByExtras.reduce((sum, debt) => sum + cents(monthlyBill.get(debt.id) || 0), 0) / 100;
    return { strategy, payments, monthly, monthlyRelief, payoffDate, interest: Math.round(interest) / 100,
      remaining: monthly.at(-1)?.debt || 0, lowest: lowest.ending, lowestDate: lowest.date,
      firstBelow: projected.find(day => cents(day.ending) < cents(buffer))?.date || null,
      safe: cents(lowest.ending) >= cents(buffer),
      accounts: debts.map(debt => ({ name: debt.name, paidOn: debt.paidOn, remaining: Math.round(debt.remaining) / 100 })) };
  }

  return { through, start, buffer, bonus, bonusEvent, lmccAssumed, reliefApproximate: monthlyBill.size > 18, starting: starting / 100, excluded, unlinked, modeled: modeled.length,
    scenarios: ['baseline', 'avalanche', 'snowball', 'relief', ...(modeled.some(debt => debt.liability) ? ['lmcc'] : [])]
      .map(simulate).filter(plan => plan.strategy !== 'lmcc' || (plan.payments[0]?.debtAccountId === lmccId && plan.accounts.some(account => account.name === '2027 LMCC dues' && account.paidOn === start))) };
}

function scenarioEvent(payment, planId, index) {
  return {
    id: 'cc-debt-' + planId + '-' + index, debtPlanId: planId,
    name: payment.name + ' — debt plan ' + planId.slice(0, 8), date: payment.date, amount: -payment.amount,
    type: 'adjustment', category: payment.debtAccountId ? 'Housing' : 'Credit Cards', payMethod: 'manual',
    ...(payment.debtAccountId ? {debtAccountId:payment.debtAccountId} : {creditCardId:payment.cardId}),
    notes: 'Additional payment from Debt Planner. Confirm the remaining balance after it posts.'
  };
}

function scenarioFingerprint(result) {
  return crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
}

function register(app, deps) {
  const { readStore, writeStore, readBills, writeBills, currentDate = today } = deps;
  const get = () => { const s = readStore(); return { ...s, revision: s.revision || 0, cards: discover(readBills(), s) }; };
  const withEstimates = s => {const cards=s.cards.filter(c=>!c.removed&&!c.paymentPlan);return {revision:s.revision,cards,removed:s.cards.filter(c=>c.removed&&!c.paymentPlan).map(c=>({id:c.id,name:c.name})),estimates:estimateBalances(readBills(),cards,deps.readCompleted?deps.readCompleted():{})};};
  app.get('/api/credit-cards', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json(withEstimates(get())); });
  app.post('/api/credit-cards', (req, res) => {
    try {
      const s = get();
      if (req.body.revision !== s.revision) return res.status(409).json({ error: 'Cards changed on another device. Reload before saving.' });
      const existing = s.cards.find(c => c.id === req.body.card?.id);
      if (existing&&(existing.removed||existing.paymentPlan)) throw new Error('Restore the card first, or manage fixed plans in Liabilities');
      if (req.body.card?.id && !existing) throw new Error('Card no longer exists. Reload before saving.');
      const old = existing || { id: crypto.randomUUID(), history: [] };
      const card = validateCard(req.body.card || {}, old);
      s.cards = s.cards.filter(c => c.id !== card.id).concat(card); s.revision++;
      writeStore(s); res.json(withEstimates(s));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  for (const action of ['remove','restore']) app.post('/api/credit-cards/'+action,(req,res)=>{try{
    const s=get();if(req.body.revision!==s.revision)return res.status(409).json({error:'Cards changed on another device. Reload before continuing.'});
    const card=s.cards.find(c=>c.id===req.body.id);if(!card)throw new Error('Card no longer exists');if(card.paymentPlan)throw new Error('Manage fixed payment plans in Liabilities');
    card.removed=action==='remove';card.removedAt=card.removed?new Date().toISOString():null;s.revision++;writeStore(s);res.json(withEstimates(s));
  }catch(e){res.status(400).json({error:e.message});}});
  function compare(data, input) {
    const date = currentDate();
    const result = debtScenarios(data, discover(data, readStore(), date), input, deps.readCompleted?.() || {}, date);
    return { ...result, fingerprint: scenarioFingerprint(result) };
  }
  app.post('/api/credit-cards/debt-scenarios', (req, res) => {
    try {
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(req.body.planId || ''))) throw new Error('Refresh and compare a new plan.');
      res.json(compare(readBills(), req.body));
    }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post('/api/credit-cards/debt-scenarios/save', (req, res) => {
    try {
      const { input, strategy, fingerprint, planId } = req.body;
      if (!['avalanche', 'snowball', 'relief', 'lmcc'].includes(strategy) || !/^[a-zA-Z0-9-]{16,80}$/.test(String(planId || ''))) {
        throw new Error('Preview a valid plan before saving.');
      }
      const data = readBills(), events = data.oneTimeEvents || [];
      const existing = events.filter(event => event.debtPlanId === planId);
      if (existing.length) return res.json({ saved: existing.filter(event => event.creditCardId || event.debtAccountId).length, bonusAdded: existing.some(event => event.type === 'income'), duplicate: true });
      const result = compare(data, { ...input, planId }), plan = result.scenarios.find(item => item.strategy === strategy);
      if (result.fingerprint !== fingerprint || !plan?.safe || !plan.payments.length) {
        return res.status(409).json({ error: 'The plan no longer matches the latest calendar or cash floor. Compare again before saving.' });
      }
      const additions = plan.payments.map((payment, index) => scenarioEvent(payment, planId, index));
      writeBills({ ...data, oneTimeEvents: [...events, ...(result.bonusEvent ? [result.bonusEvent] : []), ...additions] });
      res.json({ saved: additions.length, bonusAdded: !!result.bonusEvent });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post('/api/credit-cards/preview', (req, res) => {
    try { const s = get(); res.json(quote(readBills(), s.cards.find(c => c.id === req.body.cardId), req.body, currentDate())); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post('/api/credit-cards/payments', (req, res) => {
    try {
      const { cardId, date, amount, buffer, planId } = req.body;
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(planId || ''))) throw new Error('Invalid payment identifier');
      const data = readBills(), id = 'cc-extra-' + planId;
      if ((data.oneTimeEvents || []).some(e => e.id === id)) return res.json({ saved: true, duplicate: true });
      const card = get().cards.find(c => c.id === cardId);
      const result = quote(data, card, { amount, buffer, start: date, end: date }, currentDate());
      if (!result.safe) return res.status(409).json({ error: 'The latest calendar does not support this payment at your chosen buffer. Preview again.' });
      const planned = (data.oneTimeEvents || []).filter(e => e.creditCardId === cardId && e.date >= currentDate()).reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);
      if (cents(planned + Number(amount)) > cents(card.balance)) throw new Error('Existing extra payments plus this payment exceed the recorded balance');
      data.oneTimeEvents.push({ id, name: card.name + ' — extra payment', date, amount: -cents(amount) / 100, type: 'adjustment', category: 'Credit Cards', payMethod: 'manual', creditCardId: cardId, notes: 'Additional debt payment. Planned in Credit Cards; update the card balance after it posts.' });
      const saved = writeBills(data); res.json({ saved: true, updatedAt: saved.updatedAt });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
}
module.exports = { register, projection, discover, validateCard, quote, matching, estimateBalances, isPaymentPlan, debtScenarios };
