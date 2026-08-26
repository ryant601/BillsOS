"use strict";

const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.BILLS_DATA_DIR || path.join(__dirname, "data");
const BILLS_FILE = path.join(DATA_DIR, "bills.json");
const MARKER_FILE = path.join(DATA_DIR, ".q1-2027-calendar-seeded.json");

const entries = [
  // Q1 2027 spending-account funding: continue the current $2,250 biweekly cadence.
  { id: "q1-2027-funding-2027-01-08", name: "Fund Spending Account", date: "2027-01-08", amount: -2250, type: "transfer", notes: "Q1 2027 planned funding" },
  { id: "q1-2027-funding-2027-01-22", name: "Fund Spending Account", date: "2027-01-22", amount: -2250, type: "transfer", notes: "Q1 2027 planned funding" },
  { id: "q1-2027-funding-2027-02-05", name: "Fund Spending Account", date: "2027-02-05", amount: -2250, type: "transfer", notes: "Q1 2027 planned funding" },
  { id: "q1-2027-funding-2027-02-19", name: "Fund Spending Account", date: "2027-02-19", amount: -2250, type: "transfer", notes: "Q1 2027 planned funding" },
  { id: "q1-2027-funding-2027-03-05", name: "Fund Spending Account", date: "2027-03-05", amount: -2250, type: "transfer", notes: "Q1 2027 planned funding" },
  { id: "q1-2027-funding-2027-03-19", name: "Fund Spending Account", date: "2027-03-19", amount: -2250, type: "transfer", notes: "Q1 2027 planned funding" },

  // Jeep: continue $1,218.92/month as two $609.46 installments.
  // First installment follows the established 28-day cadence; second targets the 24th,
  // moved to the prior business day when the 24th is a weekend (Jan 2027).
  { id: "q1-2027-jeep-jan-1", name: "Jeep Jan #1", date: "2027-01-08", amount: -609.46, type: "adjustment", notes: "Q1 2027 Jeep split", paymentPart: 1, paymentParts: 2, batchId: "q1-2027-jeep-jan" },
  { id: "q1-2027-jeep-jan-2", name: "Jeep Jan #2", date: "2027-01-22", amount: -609.46, type: "adjustment", notes: "Q1 2027 Jeep split", paymentPart: 2, paymentParts: 2, batchId: "q1-2027-jeep-jan" },
  { id: "q1-2027-jeep-feb-1", name: "Jeep Feb #1", date: "2027-02-05", amount: -609.46, type: "adjustment", notes: "Q1 2027 Jeep split", paymentPart: 1, paymentParts: 2, batchId: "q1-2027-jeep-feb" },
  { id: "q1-2027-jeep-feb-2", name: "Jeep Feb #2", date: "2027-02-24", amount: -609.46, type: "adjustment", notes: "Q1 2027 Jeep split", paymentPart: 2, paymentParts: 2, batchId: "q1-2027-jeep-feb" },
  { id: "q1-2027-jeep-mar-1", name: "Jeep Mar #1", date: "2027-03-05", amount: -609.46, type: "adjustment", notes: "Q1 2027 Jeep split", paymentPart: 1, paymentParts: 2, batchId: "q1-2027-jeep-mar" },
  { id: "q1-2027-jeep-mar-2", name: "Jeep Mar #2", date: "2027-03-24", amount: -609.46, type: "adjustment", notes: "Q1 2027 Jeep split", paymentPart: 2, paymentParts: 2, batchId: "q1-2027-jeep-mar" },

  // Mortgage: $5,866.48/month, fully funded before the 17th due date.
  { id: "q1-2027-mortgage-jan-1", name: "Jan Mortgage #1", date: "2026-12-27", amount: -2500, type: "adjustment", notes: "January 2027 mortgage split", paymentPart: 1, paymentParts: 3, batchId: "q1-2027-mortgage-jan" },
  { id: "q1-2027-mortgage-jan-2", name: "Jan Mortgage #2", date: "2027-01-08", amount: -1500, type: "adjustment", notes: "January 2027 mortgage split", paymentPart: 2, paymentParts: 3, batchId: "q1-2027-mortgage-jan" },
  { id: "q1-2027-mortgage-jan-3", name: "Jan Mortgage #3", date: "2027-01-13", amount: -1866.48, type: "adjustment", notes: "January 2027 mortgage split · due Jan 17", paymentPart: 3, paymentParts: 3, batchId: "q1-2027-mortgage-jan" },
  { id: "q1-2027-mortgage-feb-1", name: "Feb Mortgage #1", date: "2027-01-27", amount: -2500, type: "adjustment", notes: "February 2027 mortgage split", paymentPart: 1, paymentParts: 3, batchId: "q1-2027-mortgage-feb" },
  { id: "q1-2027-mortgage-feb-2", name: "Feb Mortgage #2", date: "2027-02-05", amount: -1500, type: "adjustment", notes: "February 2027 mortgage split", paymentPart: 2, paymentParts: 3, batchId: "q1-2027-mortgage-feb" },
  { id: "q1-2027-mortgage-feb-3", name: "Feb Mortgage #3", date: "2027-02-13", amount: -1866.48, type: "adjustment", notes: "February 2027 mortgage split · due Feb 17", paymentPart: 3, paymentParts: 3, batchId: "q1-2027-mortgage-feb" },
  { id: "q1-2027-mortgage-mar-1", name: "Mar Mortgage #1", date: "2027-02-27", amount: -2500, type: "adjustment", notes: "March 2027 mortgage split", paymentPart: 1, paymentParts: 3, batchId: "q1-2027-mortgage-mar" },
  { id: "q1-2027-mortgage-mar-2", name: "Mar Mortgage #2", date: "2027-03-05", amount: -1500, type: "adjustment", notes: "March 2027 mortgage split", paymentPart: 2, paymentParts: 3, batchId: "q1-2027-mortgage-mar" },
  { id: "q1-2027-mortgage-mar-3", name: "Mar Mortgage #3", date: "2027-03-13", amount: -1866.48, type: "adjustment", notes: "March 2027 mortgage split · due Mar 17", paymentPart: 3, paymentParts: 3, batchId: "q1-2027-mortgage-mar" }
];

function seed() {
  try {
    if (fs.existsSync(MARKER_FILE) || !fs.existsSync(BILLS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(BILLS_FILE, "utf8"));
    const data = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    data.oneTimeEvents = Array.isArray(data.oneTimeEvents) ? data.oneTimeEvents : [];
    const existing = new Set(data.oneTimeEvents.map(row => row && row.id).filter(Boolean));
    const missing = entries.filter(row => !existing.has(row.id));
    if (missing.length) {
      data.oneTimeEvents.push(...missing);
      data.updatedAt = new Date().toISOString();
      const tmp = BILLS_FILE + ".q1-2027.tmp";
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, BILLS_FILE);
    }
    fs.writeFileSync(MARKER_FILE, JSON.stringify({ seededAt: new Date().toISOString(), added: missing.map(row => row.id) }, null, 2));
  } catch (err) {
    console.error("Q1 2027 calendar seed failed:", err && err.message ? err.message : err);
  }
}

seed();
