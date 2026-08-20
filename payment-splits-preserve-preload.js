'use strict';

// Protect split-payment metadata from older/stale Control Center payloads.
// Some clients only post bills, oneTimeEvents, income, and updatedAt. The
// server normalizer turns a missing paymentSplits field into [], which would
// otherwise overwrite valid split-payment metadata already saved on disk.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.BILLS_DATA_DIR || path.join(__dirname, 'data');
const BILLS_FILE = path.resolve(DATA_DIR, 'bills.json');
const renameSync = fs.renameSync.bind(fs);
const writeFileSync = fs.writeFileSync.bind(fs);

function readObject(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch (_err) {
    return null;
  }
}

fs.renameSync = function preservePaymentSplitsBeforeReplace(from, to) {
  if (path.resolve(String(to)) === BILLS_FILE) {
    try {
      const incoming = readObject(from);
      const existing = readObject(to);
      const incomingSplits = incoming && incoming.paymentSplits;
      const existingSplits = existing && existing.paymentSplits;

      if (
        incoming &&
        (!Array.isArray(incomingSplits) || incomingSplits.length === 0) &&
        Array.isArray(existingSplits) &&
        existingSplits.length > 0
      ) {
        incoming.paymentSplits = existingSplits;
        writeFileSync(from, JSON.stringify(incoming, null, 2));
      }
    } catch (_err) {
      // Never block a normal BillsOS save because the compatibility guard failed.
    }
  }

  return renameSync(from, to);
};
