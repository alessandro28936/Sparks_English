# Audit and Daily Report cleanup — 12 November 2026

The audit CSVs and `audit-summary.json` describe the earlier snapshot for 1 October–9 November, before the Daily Report cleanup. Their row numbers refer to that snapshot, not today's sorted sheet. The live workbook has since received newer data.

That audit independently checked 125,710 metric and outcome values without a calculation mismatch. Missing attribution remained for 635 rows across all accounts (225 within the user's assignments). These are missing/ambiguous matches, not zero Leads or Booking. Seven owned Third-account rows still needed disambiguation among full ad-set names that share the same shortened report name. The dashboard regression suite passed 147 checks, including source totals, Third matching, distinct Ad IDs, ad-set metrics and action rules.

The five pairs in `confirmed-additional-report-rows.csv` were originally confirmed as additional outcomes. Both records were retained during cleanup. On 12 November, the user subsequently confirmed that a newer CSV replaces prior outcomes within its import scope. This authorizes replacement by the new export, not automatic deduplication of rows within that export or outside its scope.

## Completed live cleanup

- Full workbook backup created before deletion: https://docs.google.com/spreadsheets/d/1BIZBIJRjZ3W-UGgC2GgkTnEqP1Ykj2xjDt3MWkEHksI/edit
- Deleted 33,780 records dated before July 2026 within the requested January–June period, plus six repeated header rows.
- Retained 56,666 dated records from 1 July–10 November, sorted by date, ad set and ad. Whole rows were sorted together, preserving attribution and annotations.
- Verified unchanged July-onward totals: 171,029 Leads; 28,113 Bookings by Booking Date; Spend 6,701,804,261.817276.
- Frozen header and identity columns, bounded filter, and uniform date format verified through native Sheets metadata. Report Totals still recalculates. No authenticated rendered Sheets preview was available.

## Daily Report CSV implementation

The dated sample contains 6,262 rows for 1–10 November, with 19,119 Leads and 1,403 Bookings by Booking Date. It has been used in local tests, not imported into the live sheet.

On 12 November the user resolved the discrepancy for 1 November CL.JU_T_D_W_TA / ITRY_1 and OLD_10: use 3 Leads each from the latest CSV, replacing the prior 6 each. The importer now permits that replacement and tests verify both ads become exactly 3, with no extra rows on a repeat upload. No CSV import has been executed against the live sheet by this local update.

The new Apps Script source and copy helper are in `import-workflow/`. Installation requires replacing the existing bound Code.gs, saving and refreshing Centers. No deployment is required. Local mocks verify the import plan, bulk writes, recovery, repeated uploads and UI status, but do not establish cloud execution time.

### Follow-up CSV import error

The live cell V49218 was verified as the literal placeholder `-`, not a manual Key Message. The importer no longer blocks on placeholders. Real labels removed by replacement are archived with their report identity in Daily Report Labels before writing outcomes. Date conversion is cached per distinct day; helper-cell updates use batch writes.

Tests with `20261112_083825.csv` and the November snapshot passed: 6,261 final report rows, 19,093 Leads, 1,402 Bookings, and 390 distinct archived labels. The mock recorded 23 spreadsheet writes for the full replacement and 10 date-format operations during planning. These are local operation counts, not a measured Google Apps Script execution duration. No live CSV import was performed during this repair.

### Follow-up performance repair

The user subsequently ran an upsert successfully; Import Log row 21 records SUCCESS in 305 seconds for 6,261 input rows, with the earlier intermediate stage `Data written; sorting full rows`. This upsert preserves unrelated groups, so its total Daily Report outcomes are not expected to equal a complete date-range replacement fixture.

The new implementation reads/sorts only the affected tail and batches all columns together. A 57,450-row history fixture reads 288,431 cells for Preview instead of 1,780,981 and sorts 7,462 rows. The replacement mock now needs 11 write calls instead of 23. All metric, label, historical-prefix and rollback checks pass. The 120-second target remains unverified in live Apps Script; stage timings and a client warning are now included to measure it honestly. The repair itself has not re-imported the user's file.
