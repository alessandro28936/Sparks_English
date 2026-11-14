# Sparks import workflow

## Daily Report CSV update — 12 November 2026

### Performance update — affected dates only

The user's last Daily Report import is confirmed SUCCESS in Import Log row 21: **305 seconds**, request `6f18b8ef-7e85-48fe-a255-a9dcf39ef0b9`. While running, its last stage was `Data written; sorting full rows`. This is evidence that writing had completed before the full-history sort; the old log does not isolate the exact duration of sorting.

The new `daily-tail-v2` path scans only the date column across history. It reads all columns starting at the first affected date, leaves the historical prefix untouched, and sorts only that tail (including later dates to preserve backfill ordering). Inputs, IDs, helper formulas and labels are combined into fewer writes. Backups, archived labels, formulas, rollback positions and filter bounds use actual sheet row numbers, including the skipped history offset. This follows [Google's batching guidance](https://developers.google.com/apps-script/guides/support/best-practices#use_batch_operations).

Local tests with 57,450 existing rows reduced full-row sorting to **7,462 rows** and Preview reads from **1,780,981 to 288,431 cells**. For the latest replacement fixture, write calls fell from **23 to 11**. Metric reconciliation, manual-label preservation, 50,000 unchanged historical rows, future-date backfills, repeated uploads and rollback passed. These are test workload counts, not measured production runtime.

**Two minutes is the target, not a verified maximum.** The dialog warns after 120 seconds without reporting success early. Import Log records per-stage durations and the measured overall duration after data writes/sorting have been applied. The new version must be installed and tested in Apps Script before a live speed claim can be made. An unchanged-file no-op is not a meaningful benchmark for a fresh import. No services, deployment or additional scopes are required for this update.

### Key Messages / replacement fix

The Preview error on row 49218 was caused by treating the placeholder `-` as a manual Key Message. Placeholders and spreadsheet error values are now ignored. Genuine labels on removed rows are archived automatically in the visible **Daily Report Labels** tab, with date, center, ad set, ad, account/IDs, import ID and backup reference. Existing labels on retained rows stay in place. The archive is separate from metric aggregation and is deduplicated on repeat attempts; the full row backup remains available. No manual move to Creative Mapping is required to finish the import.

Date objects from Sheets are converted once per distinct day, eliminating repeated Apps Script date formatting during identity comparisons. Removed helper cells and new formulas are written in batches instead of issuing a separate spreadsheet request for each scattered row group. Cloud runtime is not guaranteed by local tests.

The new file `20261112_083825.csv` contains **6,261 rows, 19,093 Leads and 1,402 Bookings**, dated **1–10 November**. For a complete replacement using this file, set **Start 2026-11-01 / End 2026-11-10**. Selecting November 11 would also remove existing November 11 rows, if present. Preview now explicitly warns when the selected range extends beyond file dates.

Update the existing bound Apps Script using `Activate-Import.html`: Copy script, replace the existing Sparks Import Code.gs, Save, refresh Centers. No Deploy or additional setup run is needed. The connected Sheets tool cannot install Apps Script code; the new menu appears only after this update.

Use **Sparks Import → Upload Daily Report CSV**. Source is **Daily Report**, destination **Copy of Daily Report**. Upload the daily export with `calendar_date` (or `Date`) in yyyy-mm-dd format and the 17 original export columns. The weekly-only export is rejected. Dates before 1 July 2026 are rejected. Optional Account Group / Account ID / Campaign ID / Ad Set ID / Ad ID retain their text precision; omitted metadata is inherited only from an unambiguous existing context.

**Update ad / dates in file** updates the complete group for each date, Ads Center, Adset Name and ad_name in the file; it preserves unrelated report history. Repeated source rows are counted, not deduplicated. A second upload of the same data does not append another copy. **Replace all centers / date range** requires a complete export for all centers and accounts in that date range; it is not appropriate for a partial export.

Preview displays file dates and totals. Import shows elapsed time and the server stage, then **Import completed** after confirmed success for that exact Import ID. The importer writes batches, backs up affected rows in a narrow hidden journal, preserves existing helper formulas and manual labels, sorts full rows by date / ad set / ad, and logs the result. An interrupted execution is never reported as success. A journal's row numbers refer to positions BEFORE sorting; do not manually restore those row numbers after sorting. Caught write failures restore before sorting; a sort/finalization failure requires checking the log rather than automatic resubmission.

The sample `20261112_032325.csv` has been tested locally against a snapshot of November report data. It has not been uploaded into the live spreadsheet, and Google Apps Script execution speed has not been measured for this new path.

**Confirmed replacement policy (12 November):** the user chose the latest CSV as the replacement for all prior outcomes within the imported scope, including previously recorded additional results. For 1 November CL.JU_T_D_W_TA / ITRY_1 and OLD_10, that means 3 Leads each instead of 6. The historical-additions blocker has been removed. Upsert still preserves groups absent from the file; complete date-range replacement still requires a complete export. Repeated rows within the new CSV remain additive, and repeat uploads are a no-op. The supplied CSV itself is now used in all replacement tests; no hypothetical additional rows are appended. Live outcomes change only when the updated importer is run.

The live sheet cleanup is complete: January–June records removed, July-onward rows sorted, totals preserved, and a full backup retained. See `../audit-results/README.md`.

The existing Centers workbook was updated in place on 2026-11-04. Its spreadsheet ID and Raw Data sheet ID remain unchanged.

## Initial import

- Main: Draft-Dashboard.xlsx, 2,092 export rows, Rp189,851,270.
- Secondary: Draft-Dashboar-3.xlsx, all 350 export rows, Rp89,713,232. Includes TBT, TCT, DPK, BGR and BHI as requested.
- Period: 2026-10-28 through 2026-11-04, inclusive.
- 7,134 rows outside replacement scopes retained; Raw Data now contains 9,576 rows.
- All 1,009 pre-existing nonblank historical label pairs matched after migration.
- Four conflicting label histories preserved as dated overrides in Creative Mapping.
- Two repeated ad/day identities in the secondary export preserved as separate rows and listed in Import Issues. No spend or Results silently discarded or doubled beyond the input file.
- Native formula scan: 0 errors. At verification, 699 rows had missing or ambiguous report matches; those Leads/Booking remain blank.
- English Daily Report currently ends on 2026-11-03. November 4 export does not imply November 4 Leads/Booking are available.

## One-time activation required

Apps Script cannot be installed through the available Google Sheets connector. The user has installed an earlier importer version; replace that existing script to activate the latest changes described above. The following steps also describe the original first-time setup.

Open Activate-Import.html, copy the script, then in Centers open Extensions > Apps Script. Paste SparksImport.gs into a script file, save, run setup, authorize with the owner's Google account, and reload Centers. Preserve any pre-existing scripts. The import menu is spreadsheet-bound and needs no public web deployment.

The script's validation and formula generation were tested in an isolated JavaScript harness using both supplied exports. Its authenticated Apps Script write path still requires verification after setup runs in Google.

## Routine import

Use Sparks Import > Upload CSV for Meta CSV exports (UTF-8, comma delimiter, English headers, yyyy-mm-dd dates, numeric decimal point and no thousands separators). Preview, then Import. Default upsert updates ads/days present in the file. The optional full-source replacement requires an explicit start/end and a complete source export.

Alternatively clear ONLY the contents of the relevant Import tab, paste an Excel export including its header into A1, and invoke that source's Import menu. Pasting alone does not update Raw Data. Do not delete sheet tabs or paste into Raw Data.

Account identity is selected by import source: SE Main, SE Secondary, SE Third, SLSA. SLSA campaign/ad set names must carry the SLSA token. Add Account ID and Ad ID to future exports. The importer uses Ad ID when provided and migrates matching legacy name identities when possible. Missing-ID records fall back to source + campaign + ad set + ad name + day. Names cannot distinguish distinct ads with identical names; review duplicate warnings.

The importer checks input before writing, uses a document lock, preserves unrelated sources/date history, makes a hidden Raw Data backup, and logs successful imports. Retain or periodically archive backups to avoid the Google Sheets workbook cell limit.

## Labels and sales outcomes

Creative Mapping: edit F (Key Message Content) and G (Content Pillar). Empty date means an entity default; a date override takes precedence. Existing dated conflicts were preserved. Mapping keys are scoped to source/campaign/ad set/ad name.

English outcomes come from Copy of Daily Report, grouped dynamically across its full available range. SLSA outcomes use the separate Daily Report SLSA template. No missing record is converted to zero. The legacy report has no account/ad IDs: multiple raw rows matching brand/date/trimmed ad set/ad code have blank Leads and Booking to prevent duplicate attribution. The two ambiguous DPK ad/day pairs therefore need Ad IDs and report mapping review before individual attribution.

Spend Share in Raw Data is now ad-row spend / source + campaign + full ad set + day spend, consistent with the dashboard's ad-set denominator. Frequency retains the export values; the dashboard's multirow aggregate remains an impression-weighted estimate.

## Backup

Full pre-migration workbook: https://docs.google.com/spreadsheets/d/1TFOS9uVQERs6dSlp9-yxThlxeQqWDKbOiU4DHc24HlI/edit

Native formatting was verified through Sheets API metadata (frozen headers, light headers, widths, percent/date formats). No authenticated visual Sheets editor was available for a rendered layout check.

## Account attribution update

Daily Report English AA:AE and SLSA F:J now accept Account Group, Account ID, Campaign ID, Ad Set ID and Ad ID. IDs are formatted as text and Account Group has Main/Secondary validation. Outcome formulas prefer explicit Account ID + Ad ID + date within brand. Account-only lookup uses report rows without Ad ID; legacy lookup uses rows without account group/ad ID and requires a unique raw match. This avoids using another known Ad ID as a fallback. No legacy account assignment was guessed. Native matching fixtures verified separate Main/Secondary outcomes, ID priority, unique legacy fallback and blanks for missing/ambiguous matches.

SparksImport.gs and Activate-Import.html include the new outcome formulas. If already installed, update the bound script before the next import. prepare_initial_import.py is a historical one-time migration helper, not the routine importer.

## Third account (2026-11-06)

### Report naming alignment (2026-11-10)

The live Report Totals formulas in A2 and M2 now infer Third for English Daily Report rows whose ad-set name contains the exact `_TA` token and Account Group is blank. Explicit Account Group values and ID matching take precedence. `_TA` reports no longer enter the account-free legacy pool. Within Third, report names such as `CL.JU_T_D_W_TA` map to `ALLS-ENG-JU_T_D_W_TA`; other center prefixes use the same `ALLS-ENG-` convention. Original report names and outcome counts are preserved. The current formulas are saved in `third-report-formulas.json`. This change is live in the sheet and needs no importer reinstallation. Date, creative code and duplicate/ambiguity guards still apply; it does not merge spelling variations in creative codes.

Import SE Third is an empty export staging tab for all Sparks English centers in the third account. Source = SE Third, Brand = English, Account Group = Third. Export per ad per day, including Account ID and Ad ID as text. Paste headers and data at A1, then use Import SE Third tab after updating the bound script using Activate-Import.html. Pasting alone does not import data.

Use the existing Copy of Daily Report for third-account Leads/Booking; select Third in AA for those rows only. Add Account ID / Ad ID where available. Do not repeat existing outcomes as new report rows. Source-scoped import keys preserve Main, Secondary and SLSA history. No third-account ad data has been imported yet.

## Import performance update (2026-11-09)

Update the existing bound Code.gs from SparksImport.gs after any current execution finishes. No deployment required. Upload the original CSV so 17–18 digit Meta IDs remain exact strings; numeric IDs already rounded by Sheets are rejected. The lowercase `Ad set ID` export header is normalized to the Raw Data `Ad Set ID` header.

The commit now writes creative mapping formulas in one batch, creates passive value backups rather than cloning live formulas, caches sort dates, and skips Raw Data writes when the source/date payload is already identical. Existing labels/outcome formulas do not affect the identical-export comparison. Every changing import still recalculates Raw Data formulas so Daily Report matching remains dynamic; cloud duration depends on spreadsheet recalculation and is not guaranteed.

Backups now come in two hidden sheets named `Backup values ...` and `Backup formulas ...`. Keep both. The first holds the prior values; the second stores original R1C1 formulas as JSON text with column/start/end rows. Neither executes lookup formulas. On caught write failures, the importer restores prior values and formulas from its in-memory snapshot. A hard timeout cannot guarantee rollback: a RUNNING log row means completion is unconfirmed, not that an execution is necessarily still active. Check Apps Script Executions before retrying. Import Log columns J/K identify the backups; L records server duration in seconds. SUCCESS is written after Raw Data flush. No-change imports use SUCCESS / No changes without another backup.

Canonical dialog: Upload.html; optimized commit: FastCommit.js. Run `python import-workflow/build_import_ui.py` after changing either to regenerate SparksImport.gs and Activate-Import.html. Local tests: `python tests/import_fast_check.py` (requires the supplied CSV and Chrome), plus `python tests/import_progress_check.py`.

## Delta writer supersedes full-table commit (2026-11-09)

The production commit is now DeltaCommit.js; FastCommit.js supplies planning helpers only. After matching the full intended source/date output, the delta writer preserves existing row positions, writes only changed input rows, clears obsolete rows in Replace mode, and fills formulas only on new/reused rows. Existing lookup formulas are never rewritten during ordinary imports. Raw Data may contain blank gaps and is not physically re-sorted; dashboard date grouping is unchanged. Source/date replacement semantics and exact ID strings are retained.

Each new backup is a hidden `Backup delta ...` journal: column A is the original Raw Data row number, B is JSON containing prior values/formulas. Date objects are tagged as `{date: ISO}`. It contains affected rows only and is not a standalone Raw Data sheet; do not paste it over Raw Data. Keep older full backups as well. Caught write failures restore the affected rows automatically. The new Import Log Stage column distinguishes backup, write, flush, and completion; RUNNING alone does not prove a live execution. Inspect Executions before retrying after a lost response or timeout.

Live snapshot regression: 11,523 rows compared against EDU-SE-Main.csv (9,905 rows, Rp1,035,041,511) required zero updates and two obsolete duplicate rows cleared in Replace mode. All other sources and existing formulas were preserved in the local commit simulation. This is not a cloud runtime benchmark, and no live import was started by the test. Run `python tests/import_delta_check.py` and `python tests/import_progress_check.py` for current verification.


## Status impor per permintaan (10 November 2026)

Setiap Preview baru memiliki Import ID. Dialog mengirim ID tersebut saat Import dan memeriksa statusnya setiap lima detik, maksimal satu pengecekan aktif. Import Log kolom N/O ditambahkan otomatis untuk ID dan fingerprint file; kolom A:M tetap dipertahankan. Tidak ada data CSV disimpan di Document Properties, hanya metadata status. Status terbaru disimpan untuk pemulihan callback; status log hanya diterima jika ID, fingerprint dan source cocok.

- Importer busy: permintaan baru belum memperoleh kunci. Tidak ada penulisan otomatis setelah kunci bebas; tombol Import kembali tersedia dengan preview yang sama.
- Import completed: konfirmasi untuk Import ID tersebut, bukan baris SUCCESS account lain. Data dan log di-flush sebelum lock dilepas. Mengirim ulang ID yang sudah selesai tidak menulis ulang data.
- Check status: membaca status tanpa mengimpor ulang. Bila koneksi callback terputus, dialog mencari status ID yang sama.
- Status needs checking: belum ada bukti selesai untuk permintaan itu. Tidak dianggap gagal total, rollback, ataupun sukses. Periksa baris Import ID tersebut di Import Log dan Apps Script Executions.

Instal pembaruan dengan membuka Activate-Import.html, menyalin script, mengganti seluruh Code.gs pada proyek Apps Script yang terhubung ke Centers, lalu Save. Tutup dialog upload lama dan refresh Google Sheet. Tidak perlu Deploy. Kode baru membuat kolom log tambahan saat impor berikutnya.

Sumber kanonis: ImportStatus.js (request identity/status), DeltaCommit.js (writer), UploadClient.js (dialog state). Jalankan build_import_ui.py untuk memperbarui Upload.html, SparksImport.gs dan helper salin script. Pengujian lokal: import_progress_check.py dan import_delta_check.py; tidak menjalankan write ke Google Sheet.
