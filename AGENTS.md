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

## Calendar card scrolling invariant

- Busy calendar day boxes must always retain the BillsOS-owned visible internal scrollbar implemented by `calendar-event-scroll-fix.js`.
- Preserve the fixed calendar-card height and the internal `.events` scrolling viewport; do not allow busy cards to expand vertically to fit all events.
- Do not remove or bypass `.billsos-card-scrollrail`, `.billsos-card-scrollthumb`, or the `billsos-has-scroll` behavior.
- `calendar-event-scroll-fix.js` must remain in `CRITICAL_ASSETS` and must continue to be injected by `cache-coherence-preload.js` for the dashboard.
- Any calendar UI/CSS refactor must keep `test/calendar-event-scroll.test.js` passing. Treat a failure of that test as a blocking regression, not an optional visual change.

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
