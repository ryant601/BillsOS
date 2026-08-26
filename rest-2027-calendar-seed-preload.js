"use strict";

const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.BILLS_DATA_DIR || path.join(__dirname, "data");
const BILLS_FILE = path.join(DATA_DIR, "bills.json");
const MARKER_FILE = path.join(DATA_DIR, ".rest-2027-calendar-seeded.json");

const entries = [
  // Apr-Dec 2027 spending-account funding: continue the $2,250 biweekly cadence.
  { id: "2027-funding-2027-04-02", name: "Fund Spending Account", date: "2027-04-02", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-04-16", name: "Fund Spending Account", date: "2027-04-16", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-04-30", name: "Fund Spending Account", date: "2027-04-30", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-05-14", name: "Fund Spending Account", date: "2027-05-14", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-05-28", name: "Fund Spending Account", date: "2027-05-28", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-06-11", name: "Fund Spending Account", date: "2027-06-11", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-06-25", name: "Fund Spending Account", date: "2027-06-25", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-07-09", name: "Fund Spending Account", date: "2027-07-09", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-07-23", name: "Fund Spending Account", date: "2027-07-23", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-08-06", name: "Fund Spending Account", date: "2027-08-06", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-08-20", name: "Fund Spending Account", date: "2027-08-20", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-09-03", name: "Fund Spending Account", date: "2027-09-03", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-09-17", name: "Fund Spending Account", date: "2027-09-17", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-10-01", name: "Fund Spending Account", date: "2027-10-01", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-10-15", name: "Fund Spending Account", date: "2027-10-15", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-10-29", name: "Fund Spending Account", date: "2027-10-29", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-11-12", name: "Fund Spending Account", date: "2027-11-12", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-11-26", name: "Fund Spending Account", date: "2027-11-26", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-12-10", name: "Fund Spending Account", date: "2027-12-10", amount: -2250, type: "transfer", notes: "2027 planned funding" },
  { id: "2027-funding-2027-12-24", name: "Fund Spending Account", date: "2027-12-24", amount: -2250, type: "transfer", notes: "2027 planned funding" },

  // Jeep: two $609.46 installments per month. First uses the first funding date in the month;
  // second targets the 24th, moved to the prior business day when the 24th is a weekend.
  { id: "2027-jeep-apr-1", name: "Jeep Apr #1", date: "2027-04-02", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 1, paymentParts: 2, batchId: "2027-jeep-apr" },
  { id: "2027-jeep-apr-2", name: "Jeep Apr #2", date: "2027-04-23", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 2, paymentParts: 2, batchId: "2027-jeep-apr" },
  { id: "2027-jeep-may-1", name: "Jeep May #1", date: "2027-05-14", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 1, paymentParts: 2, batchId: "2027-jeep-may" },
  { id: "2027-jeep-may-2", name: "Jeep May #2", date: "2027-05-24", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 2, paymentParts: 2, batchId: "2027-jeep-may" },
  { id: "2027-jeep-jun-1", name: "Jeep Jun #1", date: "2027-06-11", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 1, paymentParts: 2, batchId: "2027-jeep-jun" },
  { id: "2027-jeep-jun-2", name: "Jeep Jun #2", date: "2027-06-24", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 2, paymentParts: 2, batchId: "2027-jeep-jun" },
  { id: "2027-jeep-jul-1", name: "Jeep Jul #1", date: "2027-07-09", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 1, paymentParts: 2, batchId: "2027-jeep-jul" },
  { id: "2027-jeep-jul-2", name: "Jeep Jul #2", date: "2027-07-23", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 2, paymentParts: 2, batchId: "2027-jeep-jul" },
  { id: "2027-jeep-aug-1", name: "Jeep Aug #1", date: "2027-08-06", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 1, paymentParts: 2, batchId: "2027-jeep-aug" },
  { id: "2027-jeep-aug-2", name: "Jeep Aug #2", date: "2027-08-24", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 2, paymentParts: 2, batchId: "2027-jeep-aug" },
  { id: "2027-jeep-sep-1", name: "Jeep Sep #1", date: "2027-09-03", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 1, paymentParts: 2, batchId: "2027-jeep-sep" },
  { id: "2027-jeep-sep-2", name: "Jeep Sep #2", date: "2027-09-24", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 2, paymentParts: 2, batchId: "2027-jeep-sep" },
  { id: "2027-jeep-oct-1", name: "Jeep Oct #1", date: "2027-10-01", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 1, paymentParts: 2, batchId: "2027-jeep-oct" },
  { id: "2027-jeep-oct-2", name: "Jeep Oct #2", date: "2027-10-22", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 2, paymentParts: 2, batchId: "2027-jeep-oct" },
  { id: "2027-jeep-nov-1", name: "Jeep Nov #1", date: "2027-11-12", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 1, paymentParts: 2, batchId: "2027-jeep-nov" },
  { id: "2027-jeep-nov-2", name: "Jeep Nov #2", date: "2027-11-24", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 2, paymentParts: 2, batchId: "2027-jeep-nov" },
  { id: "2027-jeep-dec-1", name: "Jeep Dec #1", date: "2027-12-10", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 1, paymentParts: 2, batchId: "2027-jeep-dec" },
  { id: "2027-jeep-dec-2", name: "Jeep Dec #2", date: "2027-12-24", amount: -609.46, type: "adjustment", notes: "2027 Jeep split", paymentPart: 2, paymentParts: 2, batchId: "2027-jeep-dec" },

  // Mortgage: $5,866.48/month, fully funded before the 17th.
  { id: "2027-mortgage-apr-1", name: "Apr Mortgage #1", date: "2027-03-27", amount: -2500, type: "adjustment", notes: "April 2027 mortgage split", paymentPart: 1, paymentParts: 3, batchId: "2027-mortgage-apr" },
  { id: "2027-mortgage-apr-2", name: "Apr Mortgage #2", date: "2027-04-02", amount: -1500, type: "adjustment", notes: "April 2027 mortgage split", paymentPart: 2, paymentParts: 3, batchId: "2027-mortgage-apr" },
  { id: "2027-mortgage-apr-3", name: "Apr Mortgage #3", date: "2027-04-13", amount: -1866.48, type: "adjustment", notes: "April 2027 mortgage split · due Apr 17", paymentPart: 3, paymentParts: 3, batchId: "2027-mortgage-apr" },
  { id: "2027-mortgage-may-1", name: "May Mortgage #1", date: "2027-04-27", amount: -2500, type: "adjustment", notes: "May 2027 mortgage split", paymentPart: 1, paymentParts: 3, batchId: "2027-mortgage-may" },
  { id: "2027-mortgage-may-2", name: "May Mortgage #2", date: "2027-04-30", amount: -1500, type: "adjustment", notes: "May 2027 mortgage split", paymentPart: 2, paymentParts: 3, batchId: "2027-mortgage-may" },
  { id: "2027-mortgage-may-3", name: "May Mortgage #3", date: "2027-05-13", amount: -1866.48, type: "adjustment", notes: "May 2027 mortgage split · due May 17", paymentPart: 3, paymentParts: 3, batchId: "2027-mortgage-may" },
  { id: "2027-mortgage-jun-1", name: "Jun Mortgage #1", date: "2027-05-27", amount: -2500, type: "adjustment", notes: "June 2027 mortgage split", paymentPart: 1, paymentParts: 3, batchId: "2027-mortgage-jun" },
  { id: "2027-mortgage-jun-2", name: "Jun Mortgage #2", date: "2027-05-28", amount: -1500, type: "adjustment", notes: "June 2027 mortgage split", paymentPart: 2, paymentParts: 3, batchId: "2027-mortgage-jun" },
  { id: "2027-mortgage-jun-3", name: "Jun Mortgage #3", date: "2027-06-13", amount: -1866.48, type: "adjustment", notes: "June 2027 mortgage split · due Jun 17", paymentPart: 3, paymentParts: 3, batchId: "2027-mortgage-jun" },
  { id: "2027-mortgage-jul-1", name: "Jul Mortgage #1", date: "2027-06-27", amount: -2500, type: "adjustment", notes: "July 2027 mortgage split", paymentPart: 1, paymentParts: 3, batchId: "2027-mortgage-jul" },
  { id: "2027-mortgage-jul-2", name: "Jul Mortgage #2", date: "2027-07-09", amount: -1500, type: "adjustment", notes: "July 2027 mortgage split", paymentPart: 2, paymentParts: 3, batchId: "2027-mortgage-jul" },
  { id: "2027-mortgage-jul-3", name: "Jul Mortgage #3", date: "2027-07-13", amount: -1866.48, type: "adjustment", notes: "July 2027 mortgage split · due Jul 17", paymentPart: 3, paymentParts: 3, batchId: "2027-mortgage-jul" },
  { id: "2027-mortgage-aug-1", name: "Aug Mortgage #1", date: "2027-07-27", amount: -2500, type: "adjustment", notes: "August 2027 mortgage split", paymentPart: 1, paymentParts: 3, batchId: "2027-mortgage-aug" },
  { id: "2027-mortgage-aug-2", name: "Aug Mortgage #2", date: "2027-08-06", amount: -1500, type: "adjustment", notes: "August 2027 mortgage split", paymentPart: 2, paymentParts: 3, batchId: "2027-mortgage-aug" },
  { id: "2027-mortgage-aug-3", name: "Aug Mortgage #3", date: "2027-08-13", amount: -1866.48, type: "adjustment", notes: "August 2027 mortgage split · due Aug 17", paymentPart: 3, paymentParts: 3, batchId: "2027-mortgage-aug" },
  { id: "2027-mortgage-sep-1", name: "Sep Mortgage #1", date: "2027-08-27", amount: -2500, type: "adjustment", notes: "September 2027 mortgage split", paymentPart: 1, paymentParts: 3, batchId: "2027-mortgage-sep" },
  { id: "2027-mortgage-sep-2", name: "Sep Mortgage #2", date: "2027-09-03", amount: -1500, type: "adjustment", notes: "September 2027 mortgage split", paymentPart: 2, paymentParts: 3, batchId: "2027-mortgage-sep" },
  { id: "2027-mortgage-sep-3", name: "Sep Mortgage #3", date: "2027-09-13", amount: -1866.48, type: "adjustment", notes: "September 2027 mortgage split · due Sep 17", paymentPart: 3, paymentParts: 3, batchId: "2027-mortgage-sep" },
  { id: "2027-mortgage-oct-1", name: "Oct Mortgage #1", date: "2027-09-27", amount: -2500, type: "adjustment", notes: "October 2027 mortgage split", paymentPart: 1, paymentParts: 3, batchId: "2027-mortgage-oct" },
  { id: "2027-mortgage-oct-2", name: "Oct Mortgage #2", date: "2027-10-01", amount: -1500, type: "adjustment", notes: "October 2027 mortgage split", paymentPart: 2, paymentParts: 3, batchId: "2027-mortgage-oct" },
  { id: "2027-mortgage-oct-3", name: "Oct Mortgage #3", date: "2027-10-13", amount: -1866.48, type: "adjustment", notes: "October 2027 mortgage split · due Oct 17", paymentPart: 3, paymentParts: 3, batchId: "2027-mortgage-oct" },
  { id: "2027-mortgage-nov-1", name: "Nov Mortgage #1", date: "2027-10-27", amount: -2500, type: "adjustment", notes: "November 2027 mortgage split", paymentPart: 1, paymentParts: 3, batchId: "2027-mortgage-nov" },
  { id: "2027-mortgage-nov-2", name: "Nov Mortgage #2", date: "2027-10-29", amount: -1500, type: "adjustment", notes: "November 2027 mortgage split", paymentPart: 2, paymentParts: 3, batchId: "2027-mortgage-nov" },
  { id: "2027-mortgage-nov-3", name: "Nov Mortgage #3", date: "2027-11-13", amount: -1866.48, type: "adjustment", notes: "November 2027 mortgage split · due Nov 17", paymentPart: 3, paymentParts: 3, batchId: "2027-mortgage-nov" },
  { id: "2027-mortgage-dec-1", name: "Dec Mortgage #1", date: "2027-11-27", amount: -2500, type: "adjustment", notes: "December 2027 mortgage split", paymentPart: 1, paymentParts: 3, batchId: "2027-mortgage-dec" },
  { id: "2027-mortgage-dec-2", name: "Dec Mortgage #2", date: "2027-12-10", amount: -1500, type: "adjustment", notes: "December 2027 mortgage split", paymentPart: 2, paymentParts: 3, batchId: "2027-mortgage-dec" },
  { id: "2027-mortgage-dec-3", name: "Dec Mortgage #3", date: "2027-12-13", amount: -1866.48, type: "adjustment", notes: "December 2027 mortgage split · due Dec 17", paymentPart: 3, paymentParts: 3, batchId: "2027-mortgage-dec" }
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
      const tmp = BILLS_FILE + ".rest-2027.tmp";
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, BILLS_FILE);
    }
    fs.writeFileSync(MARKER_FILE, JSON.stringify({ seededAt: new Date().toISOString(), added: missing.map(row => row.id) }, null, 2));
  } catch (err) {
    console.error("Apr-Dec 2027 calendar seed failed:", err && err.message ? err.message : err);
  }
}

seed();
