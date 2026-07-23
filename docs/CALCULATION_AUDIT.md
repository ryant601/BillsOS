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