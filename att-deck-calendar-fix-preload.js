'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.BILLS_DATA_DIR || path.join(__dirname, 'data');
const BILLS_FILE = path.join(DATA_DIR, 'bills.json');
const MARKER_FILE = path.join(DATA_DIR, '.att-deck-calendar-fixed.json');

function run() {
  try {
    if (fs.existsSync(MARKER_FILE) || !fs.existsSync(BILLS_FILE)) return;

    const raw = JSON.parse(fs.readFileSync(BILLS_FILE, 'utf8'));
    const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    data.bills = Array.isArray(data.bills) ? data.bills : [];

    const att = data.bills.find(row => row && row.name === 'AT&T');
    if (att) {
      att.amount = 150;
      att.dueDay = 26;
      att.frequency = 'monthly';
      att.startMonth = att.startMonth || '2026-09';
      att.endMonth = null;
      att.active = true;
      att.payMethod = att.payMethod || 'auto';
      att.notes = String(att.notes || '').trim();
    } else {
      data.bills.push({
        id: 'bill-att-recurring-2026-09',
        name: 'AT&T',
        amount: 150,
        dueDay: 26,
        type: 'bill',
        payMethod: 'auto',
        frequency: 'monthly',
        startMonth: '2026-09',
        endMonth: null,
        active: true,
        notes: 'Recurring phone bill added after August 2026 transition charge.'
      });
    }

    const deck = data.bills.find(row => row && row.name === 'Deck Installment');
    if (deck) {
      deck.amount = 148;
      deck.dueDay = 24;
      deck.frequency = 'monthly';
      deck.startMonth = deck.startMonth || '2026-09';
      deck.endMonth = '2027-07';
      deck.active = true;
    }

    data.updatedAt = new Date().toISOString();
    const tmp = BILLS_FILE + '.att-deck.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, BILLS_FILE);
    fs.writeFileSync(MARKER_FILE, JSON.stringify({ fixedAt: new Date().toISOString() }, null, 2));
  } catch (err) {
    console.error('AT&T/deck calendar fix failed:', err && err.message ? err.message : err);
  }
}

run();
