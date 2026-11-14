# Metric audit — 6 November 2026

Source: [Centers](https://docs.google.com/spreadsheets/d/1rLd4NuAz9S2HqqiMUWqHXZkinYmjazgsm_mj473BfGw/edit). Read-only audit; the source data and native formulas were not changed.

## Confirmed screenshot issue

Ad: `15/10/26 - VAFCU_89`, ad set `TCT_T_D_W_BA_26/2/26`, Secondary account. Selected period: 22 October–4 November 2026.

| Quantity | Whole selected period | Rows with matched Leads |
|---|---:|---:|
| Spend | Rp968,643 | Rp99,915 |
| Results | 44 | 3 |
| Recorded Leads | 3, incomplete | 3 |
| Days | 14 | 6 |

The previous UI showed 100% from 3 / 3 and CPL Rp33,305 from Rp99,915 / 3 beside whole-period Spend and Results. These were valid subset calculations presented as if they applied to all 14 days. This was a dashboard display bug.

The corrected UI keeps recorded outcome counts visible but suppresses incomplete full-period CPL, CPB, Results-to-Leads and Booking conversion. No green/red judgement is applied to an unavailable ratio. If 3 Leads were the complete total for 44 Results, the ratio would be 6.82%; the existing source does not establish that 3 is complete.

## Why the eight days are not matched

From 22–29 October, multiple full ad names share the same date/ad-set/creative lookup key. On 22 October, Raw Data rows 5383, 5386 and 5389 are respectively `15/10/26 - VAFCU_89`, `21/10/26 - VAFCU_89` and `22/10/26 - VAFCU_89`. All are in the same Secondary ad set.

Report Totals row 75504 contains 12 Leads and 0 Bookings for `2026-10-22|TCT_T_D_W_BA|VAFCU_89`. It cannot identify which of the three published ads generated those Leads. The current lookup deliberately leaves per-ad outcomes blank rather than assigning 12 to all three or allocating results by spend. Account Group alone cannot resolve this case; matched Account ID + Ad ID, or a verified mapping from the original reporting system, is needed.

## Source audit scope and results

- Read Raw Data A1:AY9577: 9,576 data rows, through 4 November 2026.
- Inspected native lookup formulas and denominator formulas in Raw Data; checked Report Totals query logic and Daily Report headers.
- Independently aggregated 21,002 Daily Report rows dated 1 October–4 November from the bounded source read A64000:AE85890.
- All 9,151 uniquely matched Raw Data rows have Leads and Booking equal to the independently aggregated Daily Report. No mismatches.
- 425 Raw Data rows have unavailable outcomes: 337 share report keys with other rows; 88 have no matching report key. These are unresolved attribution/completeness issues, not established zero outcomes.
- 14 repeated Row Keys exist (28 rows), with different spend/results. They are not proven duplicate imports and were not removed; native Ad IDs are needed to distinguish identically named ads from duplicated data.

| Native metric values checked | Count | Arithmetic mismatches |
|---|---:|---:|
| CPR | 4,640 | 0 |
| CPL | 3,991 | 0 |
| CPB | 1,304 | 0 |
| Results to Leads | 4,457 | 0 |
| Hook Rate | 9,496 | 0 |
| Views Rate | 9,477 | 0 |
| CTR | 9,496 | 0 |
| Daily ad-set Spend Share | 9,570 | 0 |

CPR comparison allows export rounding up to Rp1.01; the other arithmetic comparisons use a small floating-point tolerance. Only available numeric values are counted here, not blank cells. Spend Share is checked within import source, campaign, full ad set and day.

## Dashboard changes

- Shared metric rendering uses complete period ratios, never replaces them with observed-subset ratios.
- Recorded outcome counts and incomplete metrics have concise visible labels and coverage tooltips.
- Status cells expand to show 7-day action metrics and exact dates.
- Ad detail shows Selected period vs. 7-day action metrics side by side, plus ambiguous/unmatched report dates.
- Data & Methodology describes coverage and identity limitations. CSV retains both periods and adds coverage row counts.
- Existing saved bucket evidence is preserved; displayed incomplete ratios follow the corrected interpretation.

Tests in `tests/metric-integrity.js` independently reconcile all 848 live ad groups to their source rows and reproduce the screenshot case. The partial-report regressions verify 44 Results / 3 incomplete Leads never becomes a displayed 100%, and complete 44 / 3 correctly becomes 6.82%.

## Limits

This audit verifies internal arithmetic and source-to-dashboard reconciliation, not the accuracy of the original Meta export or sales input. Daily Report outcomes use short creative names without Account/Ad IDs in the audited period. Booking uses Bookings by Booking Date, so it is not a same-cohort conversion count. Frequency is an impressions-weighted estimate because deduplicated Reach is unavailable. No source values were invented to resolve missing matches.
