# Balance Calculation Audit

## Objective
Perform a comprehensive audit of every balance-producing component in BillsOS to ensure balances are deterministic, explainable, and consistent across the application.

## Example Defect
- Date: July 21
- Beginning balance: $1,112.88
- Displayed balance: $257.54

Investigate and identify every transaction contributing to the $855.34 difference. If the difference cannot be explained entirely by visible transactions, treat it as a defect.

## Audit Scope
- Dashboard cards
- Monthly cards
- Spending account cards
- Fund cards
- Sweep cards
- Calendar balances
- Cashflow engine
- Assistant calculations

## Requirements
- Beginning balance must equal the previous ending balance.
- Every balance change must be traceable to one or more visible transactions.
- No hidden rules or hidden adjustments.
- Running balances must use a single calculation engine.
- Editing a transaction or funding amount must immediately recalculate every dependent card.
- Variable bill amounts must propagate everywhere.

## Acceptance Criteria
- No unexplained balance jumps.
- Beginning and ending balances bridge correctly across all cards.
- Every displayed balance can be reproduced from the visible transaction history.
- All cards share the same calculation pipeline before new features are added.

## Authoritative balance inventory

Only these saved, user-visible records may create a cash-flow row:

- `bills[]`: active monthly bills with a saved amount, due day, start month, optional end month, and per-occurrence exclusions created by a visible calendar edit.
- `income[]`: active income with a saved amount and visible schedule. Monthly and biweekly schedules require a saved anchor date; semi-monthly explicitly means the 15th and 30th.
- `oneTimeEvents[]`: dated, non-meta transactions and signed balance corrections shown in Control Center. A `balance-opening-adjustment` may set the requested beginning balance shown in its notes.
- Calendar amount/date edits: explicit user edits stored under `__billsos_system_rules__.calendarState`, then rendered on the affected visible transaction card. Completion state changes appearance only and never changes a balance.

Balance math starts at zero, applies every visible row in date order, and carries each month end into the next month. There are no name-based mortgage policies, hidden opening balances, July rebases, note-parsed transaction dates, automatic sweep/funding rows, or calculation-active action-log/meta rows.

The active projection horizon runs from June 2026 through December 2027. Every month carries directly into the next, including March into April 2027, and the same visible-only calculation rules continue through the end of 2027.

## Calculation-neutral preserved data

- `paymentSplits` and nested bill `paymentSplits` are preserved for compatibility but do not create balance rows. Use visible one-time payments in Control Center instead.
- `__billsos_system_rules__` has no direct amount/date and is ignored as a transaction. Only its explicit date/amount edit maps are applied to matching visible rows; `completed` is balance-neutral.
- `__billsos_action_log__`, revision metadata, timestamps, history snapshots, checkmarks, action lists, and assistant prose are calculation-neutral.
- Legacy preview files are redirected by the server to the current canonical calendar and are not production calculation paths.
