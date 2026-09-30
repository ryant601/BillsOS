# BillsOS ChatGPT Operating Rules

These rules exist so future ChatGPT sessions handle this repository consistently.

## Primary workflow

- This project is maintained through GitHub, not by handing the user standalone HTML files.
- When the user asks for a BillsOS app change, update the GitHub repository directly.
- Repository: `ryant601/BillsOS`
- Default branch: `main`
- Live app: Railway deployment connected to the repository.
- After each completed BillsOS app change, commit and push the change to `origin/main` so Railway's GitHub integration can deploy it automatically.

## Before editing

- Fetch the current file from GitHub before changing it.
- Use the latest blob SHA from `fetch_file` when calling `update_file`.
- Do not assume a local `/mnt/data` file is the source of truth.
- Do not create downloadable replacement HTML files unless the user explicitly asks for a file export.

## After editing

- Commit directly to GitHub with a clear commit message.
- Push the completed commit to `origin/main`; do not leave finished app changes only in the local worktree.
- Tell the user:
  - repo name
  - file path changed
  - short commit SHA
  - what changed
  - whether Railway should redeploy automatically

## UI / copy preferences

- Keep the BillsOS dashboard concise.
- Avoid debug/build/generated wording in the visible UI.
- Prefer simple labels such as:
  - `Bills Dashboard`
  - `July Summary`
  - `Calendar`
  - `Upcoming`
  - `Starting`, `Income`, `Outflow`, `Ending`, `Open`
- Move technical explanations, generation notes, and implementation details out of the main dashboard.

## Calendar list-view invariant

- The calendar offers a compact monthly list and optional calendar boxes, with a persistent user view choice. The list groups days into collapsible Sunday–Saturday weeks.
- A collapsed week must still show its transaction count, lowest projected balance and the date of that low point.
- Weeks with negative projected days must be visually distinct and expanded by default; manually hiding one must not hide its negative-day count or lowest balance.
- Keep all cash-flow rows in the calculation. The list may hide healthy empty days, but must show transaction days, low/negative days, today, and month end. The calendar boxes show every date, with an explicit way to reveal additional transactions on busy days.
- Avoid fixed-height day cards and nested event scrolling in the list view. Preserve editing and balance behavior in both views. Legacy grid helpers can remain available for rollback, but must not be injected into the current dashboard.
- Keep `test/calendar-list-view.test.js` passing. Treat a failure as a blocking regression.

## Recommendation threshold

- Offer planning suggestions for projected ending balances below $300, prioritizing negative days. Keep mortgage fully paid by the 17th and Jeep by the 25th; exclude fixed Upstart and Chase payments.
- Preview effects without changing payment rows, and avoid creating new low balance days in future split suggestions. Prior month income can be earmarked for the next month's mortgage or Jeep; treat it as reserved cash applied on the original payment date.
- For equal negative-day improvement, prefer the smallest effective date shift before broader low-balance improvement. Treat genuine one-time expenses as movable candidates while excluding transfers, funding rows, reconciliations, corrections, and balance-opening rows.
- The dashboard payment-day planner evaluates every date through a user-selected deadline, ranks the full 120-day effect, and shows month-by-month changes before saving a one-time expense. A save must use the latest server state and retry a single version conflict without overwriting newer rows.

## Tone of the app

- The dashboard should feel calm and operational.
- Avoid language that increases anxiety around money.
- Prioritize action-oriented information:
  - what is due
  - what is funded
  - what changed
  - what needs attention

## Cache/versioning

- When CSS, HTML, JS, or month partials change, bump query-string cache versions where relevant.
- Keep build/debug stamps out of the visible user-facing dashboard unless explicitly requested.

## Important reminder

If a future ChatGPT session starts work on this repo, read this file first and follow it before making changes.
