# BillsOS developer handoff

## October 5, 2026: Home cash-flow focus and dark calendar contrast

The current Home keeps upcoming bills, income, month-end outlook, quick actions and the existing detail drawers. Its focus card and seven-day strip read the already rendered calendar day endings and rows from `#mount`; the focus uses the saved recommendation floor and scans up to 120 future days. Home links use `?view=calendar&focus=YYYY-MM-DD` to open the relevant month/day or current-month forward suggestions. `dark-calendar-contrast.css` fills the gaps left by light-only list, box, risk and planner styles. If calendar data is unavailable, Home shows a loading state rather than inventing amounts.

## October 5, 2026: Everyday Spending retired

The owner retired the dedicated Everyday Spending pipeline. The hourly ChatGPT refresh task is paused. The production `npm start` no longer loads `live-finances-preload.js` or `spending-route-preload.js`; the home spending tile and navigation are gone, and the server returns 410 for the spending pages, import page, spending APIs, and their assets. Archived snapshots remain stored for recovery, but no import or category edits are active. The home page no longer displays bank account balances and the old balance snapshot URLs are disabled. Calendar projected balances remain part of cash-flow planning. The cash-flow calendar still includes Fund Spending Account transfers and excludes them from recommendation levers. The older spending descriptions below document the retired implementation, not current routes.

Prepared October 1, 2026 from a repository inspection of `main` at `9e0adee`. Read `AGENTS.md` first; it is authoritative where the two differ. Items marked **unconfirmed** were not verified against the deployed Railway service, the live data volume or configured variable values.

## 1. Purpose

BillsOS is Ryan Talbot's household cash-flow planning app. Ryan is the owner; the code also supports a separate read-only viewer account (who uses it is unconfirmed). The app answers: what is due, what is done, what money is available, which future dates risk running short, and how payment timing can improve that.

Main jobs: maintain recurring bills, income and one-time items in Control Center; project every day's balance across months; edit individual occurrences; split large payments; compare payment dates before saving; review Everyday Spending against the current funding cycle; show Bill Payments and Savings balances; export transactions across months; answer questions through an assistant grounded in the same calendar.

Good means:

- Advice is based on the calendar Ryan actually sees. Every cash-flow row counts, even when visually collapsed.
- Edits survive refresh, another device and a deployment.
- Scenarios disclose their effect on later months.
- The app feels calm, concise and operational, with understandable stale/failure states for bank data.
- A "successful refresh" means published and read back, not just a connector read or a Git commit.

## 2. Production architecture

CommonJS Node/Express with plain browser HTML/JS/CSS (no React build). `npm start` is the production behavior to reproduce.

| Route | Source | Notes |
|---|---|---|
| `/`, `/generated` | `generated-v5.html` | **Live dashboard.** Read and rewritten by `generatedDashboardHtml()` in `server.js`, then transformed by preloads. The versioned name does not make it obsolete. |
| `/control`, `/control.html` | `control.html` | Owner-only Control Center. Server injects access markup, `control-theme.css`, `control-preview.js`. |
| `/legacy` | `index.html` | Rollback UI. Server injects old `cloud-sync.js`. `/index.html` redirects here. |
| `/generated*.html`, `/latest.html` | — | Redirect to `/?view=calendar`. |
| `/spending/`, `/spending/archive/YYYY-MM-DD/` | `spending/…` | Everyday Spending, enhanced by `spending-route-preload.js`. |
| `/finances-refresh` | generated | Owner-only four-file snapshot import (`live-finances-preload.js`). |
| `/api/calendar-readonly`, `/calendar-readonly.json` | generated | **Intentionally public**, installed before login. Exposes calendar/checkmark data, not credentials. |

`server.js` owns auth, base routes, Control Center storage, completions, category-override APIs, assistant registration and static serving (`express.static(__dirname)`), and applies many literal HTML replacements.

### Preload order (`npm start`)

Order matters. These wrap shared Node APIs (`fs.readFileSync`, `fs.renameSync`, Express static/export). `node server.js` alone is **not** equivalent. Never remove a preload just because its name says "hotfix".

1. `live-finances-preload.js`: live volume snapshots override checked-in fallbacks; adds owner refresh routes.
2. `q1-2027-calendar-seed-preload.js`: marker-guarded calendar seed.
3. `rest-2027-calendar-seed-preload.js`: marker-guarded 2027 seed.
4. `att-deck-calendar-fix-preload.js`: marker-guarded one-time AT&T/deck repair.
5. `payment-splits-preserve-preload.js`: wraps `fs.renameSync` to keep existing non-empty `paymentSplits` when incoming data omits them or sends `[]`.
6. `readonly-calendar-preload.js`: installs public read-only routes before auth.
7. `html-hotfix-loader.js`: wraps `fs.readFileSync` to transform HTML and inject balance/home behavior.
8. `cache-coherence-preload.js`: forces critical asset versions via its `BUILD` tag, upgrades old sync references, injects assistant consistency, 14-day income and spending sidebar.
9. `spending-route-preload.js`: current and archived spending pages.

### Storage

| Location | Meaning |
|---|---|
| `BILLS_DATA_DIR/bills.json` | Authoritative calendar input: bills, income, one-time events, split metadata, revision. Default `data/`; production mount historically `/app/data`. |
| `BILLS_DATA_DIR/checkmarks.json` | Server completion flags. |
| `BILLS_DATA_DIR/history/bills-*.json` | Safety copies before each calendar write; newest 200 kept. |
| One-time row `__billsos_system_rules__` (JSON in `notes`) | Sync metadata/rules incl. `calendarState` (date/amount adjustments, completion, revision). Metadata, not a cash-flow row. |
| Browser localStorage | `billsos-pay-adjust-v1`, `billsos-amount-adjust-v1`, `billsos-generated-done-v5`, view prefs. A cache, not durable shared storage. |
| `BILLS_DATA_DIR/live-finances/releases/<release>/` + `current-release` | Validated bank snapshot releases; pointer switched atomically. |
| Repo JSON snapshots | Fallbacks when no live release exists; not necessarily current. |
| `spending/vendor-category-rules.json` + override store in data dir | Classification rules and saved overrides (see `spending-category-overrides.js` for precedence). |
| `calendar-readonly.json` / `BILLS_READONLY_FILE` | Derived export; not editable source. |

"Cloud sync" means API persistence to this server. The current calendar uses `billsos-cross-device-sync-v2.js`; `cloud-sync.js` is legacy checkmark sync. Neither is bank refresh.

## 3. Data flow and projected balances

1. Control Center loads/saves `/api/bills` (`bills.json`). Writes require the same source version; stale writes get 409 with current data. `bills-data-integrity.js` preserves calendar metadata. Writes go to a temp file then rename, then regenerate the read-only export.
2. `cashflow-engine.js` expands active monthly bills (respecting start/end months and `excludedDates`; due days clamp to month length; bills negative). Income: manual, monthly, biweekly anchored on a start date, semi-monthly 15th/30th. One-time items use explicit dates; corrections keep their signed behavior. Rows starting `__billsos_` never become cash flow.
3. Horizon is June 2026 – December 2027 with `FIRST_BEGIN=0`. Opening-balance adjustments can reset a day's beginning balance; each month's ending carries forward. Don't swap the opening balance for a bank balance without checking the reconciliation logic.
4. The dashboard applies occurrence amount/date overrides **before** filtering into months (required for cross-month moves). `calendar-list-view.js` builds daily summaries; `amount-balance-hotfix.js` also recalculates balances; home, sidebar and assistant consume those results. The unadjusted engine model alone does not reproduce Ryan's edited calendar.
5. Edits are keyed by original `date|name|signed amount`. Sync v2 sends `PATCH /api/bills/calendar-state` with a base revision. Date resets write timestamped `{deleted:true,…}` tombstones so an older cloud move cannot return. Never just delete a reset key.
6. `calendar-payment-split.js` turns an occurrence into explicit negative one-time parts (batch ID, part counts, exact cents) and adds the original date to the bill's `excludedDates`; for a one-time source it replaces the original. Legacy `paymentSplits` metadata is retained separately; the engine does not generate visible parts from it.
7. Checkmarks are presentation only: checking a payment does not remove or double-count its cash flow.

### Spending and bank data

Everyday Spending is a separate ledger from the bill-pay calendar. "Fund Spending Account" is an outflow in the calendar and funding in spending reconciliation; individual spending transactions must not be re-added as bill-pay outflows.

Four-file envelope: `spending/current.json`, `bill-payments-balance.json`, `savings-account-balance.json`, `spending-last-pull.json`. `scripts/verify-spending-snapshot.js` validates schema, identities, cents and reconciled metrics. Bank values use exact `balances.available`; timestamps must agree. Refresh validates the whole envelope, rejects stale replacements, writes a release, then activates all four with one pointer change; failure keeps the previous release.

Preserve every posted/pending transaction and existing classifications. Historical exclusions (cycle-funding transfers, matched eBay/Bills transfer pairs, ATM transfer/withdrawal pairs and fees, refunds/credits) must follow the current verifier/rules and never silently drop source evidence. Keep archived cycles.

The browser import exists. Automatic hourly acquisition and publication is **unconfirmed**.

## 4. Deploy, config and local testing

- Railway project `7b25b892-ebce-4364-af7d-52b76f068dff`, environment `170d415c-985e-4cc7-bdcb-b107be52c56f`, service `4f26d250-66a9-44ce-80fa-ea79256c8e96`, volume `/app/data`, app https://billsos-production.up.railway.app
- Pushes to `origin/main` trigger the GitHub-connected Railway deploy. Deployed SHA, start-command override, replicas and health are **unconfirmed**. `package.json` `billsosBuild` metadata is not deployment proof.

Environment variable names (values never belong in the repo):

| Purpose | Preferred | Compatibility |
|---|---|---|
| Owner login | `BILLS_OWNER_USERNAME`, `BILLS_OWNER_PASSWORD` | `BILLS_USER`, `BILLS_PASS` |
| Session signing | `BILLS_SESSION_SECRET` | `SESSION_SECRET`; falls back to owner password |
| Viewer (optional) | `BILLS_VIEWER_USERNAME`, `BILLS_VIEWER_PASSWORD` | `BILLS_TEMP_USER`, `BILLS_TEMP_PASS` |
| Storage / port | `BILLS_DATA_DIR`, `PORT` | |
| Assistant (optional) | `OPENAI_API_KEY`, `OPENAI_MODEL` | `OPENAI_KEY`, `CHATGPT_API_KEY`, `CHATGPT_MODEL` |
| Read-only export tooling | `BILLS_READONLY_FILE`, `BILLS_READONLY_EXPORT_ONLY` | |

Auth: HMAC-signed 30-day `billsos_session` cookie (`HttpOnly; Secure; SameSite=Strict`) with a credential fingerprint, so password changes invalidate sessions. Missing config returns 503; unauthenticated APIs 401; viewer mutations 403 except assistant query/intent POSTs. Control Center and finance refresh are owner-only. UI hiding is not the security boundary.

Local testing: use a fresh temporary `BILLS_DATA_DIR` (startup seeds can mutate data, so never point at production), local-only owner credentials and session secret, then `npm install` and `npm start`. The `Secure` cookie may need a local HTTPS proxy; do not weaken production cookies. Run `npm test` (and `npm run verify:spending` when touching spending data).

## 5. Ryan's rules and preferences (beyond AGENTS.md)

- Analyse the live calendar he sees; never present a stale export as live.
- Spending Account funding is about $2,200 every two weeks (current amount comes from Control Center). It stays in projections and is never a timing lever.
- Verizon was removed from August onward after moving to AT&T; don't recreate it from old seeds.
- Jeep fully due by the 25th, mortgage by the 17th. Prefer useful mortgage/Jeep splits before ordinary shifts, and say plainly when an action this month protects a later named month. Other bills may get permanent due-date suggestions; Upstart/Chase are excluded.
- Calm theme: current is navy/sage (accent `#24406b`, ink `#1a2233`, background `#f6f7f4`, income `#3d7a5a`, outflow `#9c3d33`, transfer `#866524`). Old teal (`#1f3a3d`) and clay (`#c15f3c`) palettes are history.
- Keep controls compact and pills understated. Header actions (Find a payment day, Month items, Export transactions) use the compact `.hero .nav .export-btn` style.
- Rejected UI: a prominent "Balance bridge" and a pseudo-element "More" label. The calendar still needs an explicit way to reveal extra transactions.
- Bank refresh should publish automatically after the hourly refresh; the manual importer is a fallback only.
- Hidden rules that create undisclosed money movement are unwanted. The `__billsos_system_rules__` metadata row is necessary for sync; migrate its function before removing it.
- Apple Reminders/Shortcut work was troublesome; status **unconfirmed**.

## 6. Fragile areas

The main risk is layered mutation: literal `server.js` replacements, several `fs.readFileSync` wrappers, static middleware wrappers and browser DOM patches. A template can look right on disk and be served differently, and a literal replacement silently stops matching after markup edits. Test served HTML in a browser, not only source files.

- Load the v2 sync script exactly once; duplicates can overwrite edits or resurrect reset dates.
- Event keys use name and signed amount, so renaming/repricing a source can orphan overrides.
- The split-preserve wrapper can restore old metadata when an empty array is saved intentionally.
- Control Center restore paths historically dropped newer fields; don't bypass the integrity code.
- Cross-month moves must leave the old month, appear once in the new one, update carry-forward, and survive refresh and another device.
- Opening adjustments and signed corrections are not expenses; misclassifying them inverts amounts.
- Thresholds differ on purpose: user floor $0–$500, $300 list warnings, engine helper default $1,000 (`FLOOR`). Don't unify them by accident.
- The December 2027 horizon is hardcoded in several files; extend it everywhere at once (navigation, split validation, export, recommendations).
- Startup seeds depend on marker files; a fresh volume can replay them.
- Public read-only routes and root static serving deserve review before any access change.

Key tests:

| Test | Guards |
|---|---|
| `test/calendar-list-view.test.js` | Every daily balance counted, risk days visible, negative/current weeks expanded, single sync script, reset tombstones. **Blocking.** |
| `test/calendar-payment-split.test.js` | Exact cents, no duplicated original, recurring exclusion, load order. |
| `test/negative-balance-recommendations.test.js` | Non-mutating previews, deadlines/exclusions, forward planning, funding never a lever, floor priority. |
| `test/live-finances-preload.test.js` | Four-file validation, stale protection, atomic switch, rollback on failure. |
| `scripts/verify-spending-snapshot.js` | Spending snapshot consistency. |

## 7. Open work

| Work | Status |
|---|---|
| Navy/sage theme, compact header buttons | On `main` via `9e0adee`; production visual check pending. |
| Month items list, quieter rows | Implemented (`14259c2`, `2d09122`). |
| Cross-month edits, durable resets, recommendation floor, forward splits | In code with tests; production retest of the Oct 2 → Sep 30 move/reset **unconfirmed**. |
| Multi-month CSV export | Present. |
| Automatic hourly Finances refresh → publish → read-back | Priority; storage and owner import exist, scheduler **unconfirmed**. Don't disable existing automation while investigating. |
| Permanent vendor due-date recommendations | Requested for non-fixed bills; implementation **unconfirmed**. |
| Manual sweeps, Apple Reminders Shortcut | Historical, **unconfirmed**. Don't restore old safe-sweep logic or invent hidden transfers. |

## 8. Cleanup candidates

Nothing here is certified safe to delete yet. Sequence: inventory references → capture served HTML and calculation output → migrate one layer → run tests and owner/viewer/sync smoke checks → retire the old layer.

| Candidate | Assessment |
|---|---|
| `generated.html`–`generated-v4.html`, `latest.html` | Strong candidates; URLs already redirect. Keep the redirects. |
| `generated-v5.html` | Live. Keep. |
| `index.html`, `months/*.html`, `cloud-sync.js` | Back `/legacy` rollback; keep until rollback is retired deliberately. |
| `billsos-cross-device-sync.js` (v1) | Candidate after a repo-wide search; never load alongside v2. |
| Seed/fix preloads (`q1-2027`, `rest-2027`, `att-deck`) | Convert to explicit migrations after checking markers and backups. |
| `payment-splits-preserve-preload.js` | Replace with explicit integrity logic and clear delete semantics. |
| `html-hotfix-loader.js`, `cache-coherence-preload.js`, `spending-route-preload.js`, `amount-balance-hotfix.js` | Active behavior, not throwaway patches. Consolidate with served-output regression checks first. |
| Checked-in bank JSON snapshots | Still used as fallbacks; don't remove without defined first-start behavior, and never commit new financial data to refresh production. |

Claude Code and ChatGPT/Codex both change this repo. Re-read `main` immediately before editing.
