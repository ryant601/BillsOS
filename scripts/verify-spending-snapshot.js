'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const fail = message => { throw new Error(message); };
const cents = value => Math.round(value * 100);
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validDay = value => typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value) &&
  new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
const previousDay = value => new Date(Date.parse(value + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);

function checkBalance(data, file, schema, name, officialName, mask) {
  if (data.schema !== schema || data.version !== 1 || data.source !== 'Finances' ||
      data.sourceField !== 'balances.available' || data.account?.institution !== 'TD Bank' ||
      data.account?.name !== name || data.account?.officialName !== officialName ||
      data.account?.mask !== mask || data.balance?.currency !== 'USD' ||
      typeof data.balance?.available !== 'number' || !Number.isFinite(data.balance.available) ||
      !validTime(data.bankingAsOf)) fail(file + ': invalid account identity, available balance, or banking timestamp');
  return data;
}

function verify() {
  return verifyData(read('spending/current.json'), read('spending-last-pull.json'),
    read('bill-payments-balance.json'), read('savings-account-balance.json'));
}

function verifyData(snapshot, pull, bill, savings) {
  checkBalance(bill, 'bill-payments-balance.json', 'billsos-bill-payments-balance', 'Bill Payments', 'TD BEYOND CHECKING', '6189');
  checkBalance(savings, 'savings-account-balance.json', 'billsos-savings-account-balance', 'Savings Account', 'TD SIMPLE SAVINGS', '2468');
  const cycle = snapshot.cycle || {};
  const metrics = snapshot.metrics || {};
  if (snapshot.schema !== 'billsos-everyday-spending' || snapshot.version !== 1 ||
      !validDay(cycle.start) || !validDay(cycle.end) || !validDay(cycle.nextTransfer) ||
      cycle.start > cycle.end || cycle.end !== previousDay(cycle.nextTransfer)) fail('Invalid spending cycle dates');
  if (!Array.isArray(snapshot.transactions)) fail('Missing transaction list');
  let total = 0, pending = 0, posted = 0;
  for (const [index, row] of snapshot.transactions.entries()) {
    if (!validDay(row.date) || row.date < cycle.start || row.date > cycle.end ||
        typeof row.c !== 'string' || !row.c.trim() || typeof row.s !== 'string' || !row.s.trim() ||
        typeof row.m !== 'string' || !row.m.trim() || typeof row.a !== 'number' ||
        !Number.isFinite(row.a) || row.a < 0 || typeof row.p !== 'boolean') fail('Invalid transaction at index ' + index);
    const amount = cents(row.a);
    total += amount;
    if (row.p) pending += amount; else posted += amount;
  }
  if (cents(metrics.totalSpent) !== total || cents(metrics.pendingSpend) !== pending ||
      cents(metrics.postedSpend) !== posted || !Number.isFinite(metrics.remainingAvailable) ||
      !Number.isFinite(metrics.transferredIn) || !Number.isFinite(metrics.percentCycleFundsUsed) ||
      !Number.isFinite(metrics.availablePerDay)) fail('Spending metrics do not reconcile');
  if (!validTime(snapshot.freshness?.balanceAsOf) ||
      pull.schema !== 'billsos-spending-pull' || pull.version !== 1 || pull.source !== 'Finances' ||
      !validTime(pull.pulledAt) || pull.bankingAsOf !== snapshot.freshness.balanceAsOf)
    fail('Spending banking timestamp and pull metadata disagree');
  return { transactions: snapshot.transactions.length, totalSpent: metrics.totalSpent,
    balanceAsOf: snapshot.freshness.balanceAsOf, billPayments: bill.balance.available,
    savings: savings.balance.available };
}

if (require.main === module) {
  try { console.log(JSON.stringify(verify())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { verify, verifyData };
