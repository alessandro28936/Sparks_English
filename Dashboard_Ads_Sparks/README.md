# Sparks Creative Intelligence

Buka `Dashboard_ads.html` di Chrome/Edge. File ini sudah mencakup HTML, CSS, JavaScript, dan mesin analisis. Koneksi internet diperlukan untuk membaca Google Sheet. Tidak perlu memasang Node atau menjalankan build untuk menggunakannya.

## Alur kerja

1. Pilih **My assignments**, **Centers / Preheat / All work**, periode, brand, objective dan jenis Results. Tampilan awal menggunakan 7 hari terakhir yang tersedia pada data, Sparks English, WhatsApp (Traffic + Leads). Periode default mengikuti tanggal terbaru saat sinkronisasi; tanggal yang dipilih manual tetap dipertahankan. **Reset filter** kembali ke periode otomatis.
2. Buka **Pusat peringatan** untuk ad di atas target CPR, tanpa Results, atau belum diisi key message.
3. Klik ad pada **Creative explorer** untuk benchmark, spend share, data harian, dan brief eksperimen yang bisa disalin.
4. Gunakan **Center insights** untuk total dan rata-rata per cabang. **Key message lab** menampilkan matrix dan kandidat pesan setelah kolom sumber dilengkapi.
5. Isi **Key Message Content** dan **Content Pillar** di tab **Creative Mapping** untuk ad yang relevan. Sinkronkan manual atau tunggu polling 10 menit selama halaman terbuka.

Target CPR Rp30.000, minimum spend Rp90.000, dan minimal 5 Results untuk kandidat iterate. Ambang dapat diubah melalui **Atur** dan disimpan di browser.

## Action rules v3 (6 November 2026)

Rekomendasi tindakan memakai 7 hari kalender terakhir sampai tanggal akhir pilihan, dibatasi tanggal data terbaru. Ad baru memakai hari sejak publish. Tabel umum mempertahankan angka rentang tanggal; Meeting & Action dan kandidat iterasi menampilkan angka evaluasi. Detail ad dan CSV memisahkan kedua periode. Bucket baru menyimpan angka, alasan, tanggal dan versi aturan; snapshot lama tidak diubah.

Hanya ad active yang mendapat tindakan baru. Semua kill menunggu minimum spend Rp90.000. Aturan Results to Leads membutuhkan minimal 5 Results. Nilai kosong bukan nol.

- K1: Results to Leads <60%.
- K2: umur >3 hari, 0 Results pada empat hari kalender berturut-turut sampai tanggal evaluasi, dengan spend. Harus ada baris pada keempat hari; tidak bergantung pada spend share.
- K3: umur >3 hari, spend share >1%, Results 1-4, CPR >2 kali CPR center bulan kalender penuh sebelumnya.
- K4: umur >=7 hari, Results to Leads <70%, Booking =0.
- K5: umur >12 hari, Results to Leads <80%, Booking >0, CPB >Rp1.000.000.

K1/K3 menjadi Prioritas review jika sudah ada Booking dengan CPB <= benchmark center. Booking positif tanpa benchmark CPB cukup juga ditinjau, tidak langsung kill. K4/K5 tetap berlaku bila memenuhi syarat. Benchmark CPR bulanan memakai total spend / Results center pada brand, objective, jenis Results dan scope account yang sama, mengecualikan ad ini; minimal spend dan Results berlaku. Benchmark CPB memakai peer center pada jendela evaluasi dengan Booking lengkap dan positif. Benchmark CPR tidak cukup menghasilkan review untuk K3.

Status utama: Rekomendasi kill, Prioritas review, Layak iterate, Prioritaskan delivery, Monitor, Data minim, Perlu validasi, Inactive, Belum ada data. Layak iterate memakai keunggulan Results/CPR, Leads/CPL atau Booking/CPB terhadap ad lain dalam ad set pada jendela evaluasi. Kandidat dengan spend share <1% menjadi Prioritaskan delivery. Inactive tidak masuk kandidat tindakan baru.

Additional metrics hanya memberi label pendamping Evaluasi creative: CTR <1%, Hook <=25%, Views rate <=30%, Frequency >3. Hook/Views <10% menjadi prioritas creative. Additional metrics tidak memicu kill atau membatalkan kandidat iterasi. Aturan lama spend share empat hari dan kill berbasis additional metrics dihapus. Semua tindakan Meta dilakukan manual.

## Umur ad

Tanggal awal Ad name dibaca sebagai tanggal publish dalam format D/M/YY atau D/M/YYYY; `9/9/26 - IAFBE_4` berarti 9 September 2026. **Umur ad** dihitung secara inklusif sejak publish sampai tanggal penilaian, dibatasi tanggal data terakhir yang tersedia. Tanggal tidak valid menghasilkan `—`.

**Hari tercatat aktif** menghitung tanggal unik dengan Ad delivery = active pada ad, campaign, dan ad set yang sama dari seluruh riwayat yang tersedia hingga tanggal penilaian. Detail menampilkan status per tanggal termasuk inactive. Umur publish bukan durasi aktif; hari sebelum awal data atau tanggal yang hilang tidak diasumsikan aktif. Export CSV menyertakan umur, tanggal publish, jumlah hari tercatat aktif, tanggal penilaian, dan alasan kill.

## Daily, Weekly, dan Monthly

Di Creative Explorer, Daily dan Weekly kini membuka **Perbandingan**: satu baris per entitas ad, dengan periode berdampingan di bawah tiap metrik. Weekly menampilkan label singkat **Week 40** sesuai kolom AK. Pilihan **Tabel periode** mempertahankan tabel detail per periode, juga tanpa tanggal pada kolom Week.

Daily Perbandingan memakai jendela **1D, 3D, 7D, 14D, 30D** yang berakhir pada tanggal data terakhir dalam filter. Setiap jendela dibatasi rentang tanggal; jendela yang terpotong ditandai parsial. Jendela ini tumpang tindih dan tidak boleh dijumlahkan. Export menyertakan nama jendela dan tanggal efektifnya. Status terbaru mengacu ke 1D atau minggu terakhir yang ditampilkan. Warna CPR menggunakan target CPR; warna CPL/CPB membandingkan nilai dengan total kolom, bukan target CPL/CPB baru.

**Ringkasan → Tren main metrics** menampilkan enam chart: Results, Leads, Booking, CPR, CPL, dan CPB. Pilih Daily / Weekly / Monthly untuk mengubah pengelompokan chart. Buka **Lihat angka per periode** untuk melihat nilai tepatnya. KPI utama tetap menunjukkan total rentang tanggal.

**Creative explorer → Tampilan data creative** menyediakan Summary / Daily / Weekly / Monthly. Summary mempertahankan total per ad; pilihan lainnya membuat satu baris per ad per periode. Weekly menggunakan **Week Num dari kolom AK pada Raw Data**, bukan nomor minggu yang dihitung ulang dari tanggal. Panel **Pilih Week Num** menampilkan seluruh minggu yang tersedia dalam rentang tanggal dan memungkinkan pemilihan satu minggu. Tabel, detail, benchmark, spend share, brief, dan export CSV mengikuti Week Num sumber yang sama. Nomor minggu dipisahkan berdasarkan tahun tanggal data; Week Num kosong/tidak valid memiliki kelompok tersendiri dan tidak ditebak. Pusat peringatan tetap memakai total rentang tanggal.

Rentang tanggal selalu diterapkan sebelum pengelompokan. Weekly di Creative Explorer memakai Week Num (AK); chart Weekly di Ringkasan masih menggunakan Senin–Minggu. Monthly memakai bulan kalender. Periode yang terpotong batas tanggal diberi label **parsial** dan tidak diekstrapolasi. Untuk Weekly Explorer, batas yang ditampilkan mengikuti tanggal data yang tersedia untuk Week Num tersebut, bukan asumsi awal/akhir minggu kalender. Tidak ada data ditampilkan sebagai jeda/`—`, bukan hasil nol. Rasio biaya dihitung ulang dari total masing-masing periode.

BDS adalah center tersendiri yang masih dibangun; tidak disamakan dengan BSD. Token `SLSA` pada campaign atau ad set menandai Sparks Leadership Speech Academy. Kolom Brand eksplisit juga dibaca. Account Group memisahkan identitas ad dan spend share antara main dan secondary account.

## Perhitungan

- CPR, CPL, CPB dihitung ulang dari total spend dan total hasil, bukan rata-rata rasio baris.
- Spend share memakai total spend ad set pada periode sebagai denominator, sebelum filter pencarian/key message. Detail ad menampilkan Spend Share asli per baris.
- Objective, jenis Results, dan brand yang berbeda tidak digabung untuk CPR dan rekomendasi.
- Nol denominator ditampilkan sebagai `—`. CPL/CPB/Results-to-Leads tidak dihitung bila kolom sumber terkait belum lengkap.
- CTR memakai clicks/impressions. Hook memakai 3-second plays/impressions video. Views rate memakai 100%-plays/views video, mengikuti formula yang terlihat pada sheet.
- Kode V menandai video dan I menandai image. Format tidak diketahui tidak diberi diagnosis video. Frequency hanya estimasi rata-rata berbobot impressions, bukan deduplikasi reach lintas hari.
- Alerts dan kandidat iterate merupakan aturan prioritas operasional. Diagnosis merupakan hipotesis yang perlu diuji lewat creative dan konteks delivery/sales.

## Data & akses

Dashboard membaca tab Raw Data dan Knowledge dari spreadsheet yang sudah digunakan dashboard lama. Daily Report tidak digabung kembali sehingga Leads/Booking tidak terhitung dua kali. Dashboard hanya membaca Google Sheet dan tidak mengubah iklan Meta. Alur impor spreadsheet dijelaskan di `import-workflow/README.md`.

Jalur baca memakai Google Visualization JSONP. Jika akses sheet berubah sehingga tidak bisa dibaca browser, dashboard akan menunjukkan kegagalan sinkronisasi. Data terakhir yang berhasil dimuat tetap terlihat dalam sesi tersebut. Polling berhenti ketika halaman ditutup. Tidak ada notifikasi email/WhatsApp atau penyimpanan performa pada layanan lain.

## Mengembangkan

Source ada di `src/`. Setelah mengubah source, jalankan:

```powershell
python build.py
```

File hasil tetap `Dashboard_ads.html`. Versi sebelum perombakan disimpan di `.work/Dashboard_ads.original.html`.

QA browser: `python tests/browser_check.py` memerlukan Python package `websockets` dan Chrome yang sudah terpasang. Tes menggunakan profil Chrome headless terpisah, HTTP lokal sementara, serta data Google Sheet aktual. Server/browser dihentikan setelah pemeriksaan. Data sintetis hanya digunakan di dalam tes untuk menguji perhitungan; tidak dimasukkan ke dashboard.


## Peluang iterasi di Ringkasan

Daftar creative dipisahkan menjadi Booking, Leads, dan Results, hanya untuk status Layak iterate / Prioritaskan delivery dari evaluasi 7 hari. Minimum spend dan Results tetap berlaku. Biaya kategori harus tidak melebihi benchmark ad lain dalam ad set, brand, objective, jenis Results, dan periode yang sama. Benchmark dihitung dari total spend / total hasil, sebelum pencarian dan filter key message; tanpa data peer lengkap, kategori tersebut tidak dinilai.

Kandidat berada pada kombinasi volume dan biaya yang tidak dikalahkan sekaligus oleh ad lain dengan sampel cukup. Semua kandidat ditampilkan, tanpa batas empat ad. Satu ad dapat masuk beberapa kategori; kartu Ringkasan menghitung ad unik. CPR di atas target diberi label relatif, dan hasil kategori di bawah minimum Results diberi label sinyal awal. Ad berstatus kill tidak dimasukkan ke daftar iterasi. Tabel memuat tiga biaya beserta benchmark, spend share, status, dan fokus perbaikan creative.

Pengujian seleksi: `tests/iteration.js`, dijalankan lewat `tests/browser_check.py` bersama pengujian dashboard lainnya.


Aturan tindakan terbaru mengikuti Action rules v3 di atas. Chart per center tetap mengikuti filter dan memakai rasio dari total spend / hasil.


## Rata-rata dan perubahan per periode

Tabel Lihat angka per periode memiliki pilihan Periode sebelumnya (default) dan Rata-rata rentang tanggal. Results, Leads, Booking, dan Spend dibandingkan per hari dengan data. CPR, CPL, CPB memakai total Spend / total hasil, bukan rata-rata rasio harian. Baris rata-rata mencakup seluruh filter tanggal. Hijau berarti hasil meningkat atau biaya per hasil menurun, merah sebaliknya; Spend netral. Intensitas warna dibatasi pada perubahan 50%, tanpa membatasi angka persentase.

Data pembanding sebelumnya dapat berasal dari luar rentang tanggal dengan filter lainnya tetap sama. Weekly masih kalender Senin-Minggu. Bagian minggu dibandingkan dengan hari yang sama seminggu sebelumnya. Bagian bulan memakai tanggal yang sama bulan sebelumnya, dibatasi tanggal yang tersedia di kedua bulan; bulan penuh dibandingkan bulan penuh dengan hasil per hari. Data terbaru membatasi akhir perbandingan. Hari kosong tidak dianggap nol: perbandingan sebelumnya memerlukan baris pada setiap hari dalam kedua bagian periode. Data kosong, nilai pembanding nol, dan jenis hasil/brand berbeda tidak menghasilkan warna performa. Filter tanggal dan total yang ditampilkan tidak diubah oleh pilihan pembanding.

Pengujian tambahan: `tests/period-learning.js`.


Tabel periode kini menonjolkan rata-rata per hari pada kolom jumlah/Spend, sesuai dasar warna dan persentase. Total tetap terlihat sebagai angka sekunder. Tanggal pembanding ditulis sekali per baris; toggle Detail angka pembanding membuka angka pembanding setiap metrik. Cara membaca warna tersedia dalam penjelasan yang dapat dibuka. Dua total Booking identik bisa berbeda warna jika jumlah hari atau angka pembanding berbeda.


Tombol Daily / Weekly / Monthly kini juga tersedia langsung di atas tabel periode, tersinkron dengan chart dan tetap mempertahankan filter tanggal. Baris Total per metrik telah dihapus agar tabel hanya menampilkan rata-rata dan perubahan; total utama tetap tersedia pada KPI dashboard.


## Meeting & Action (pengembangan lokal)

Menu baru terdiri dari Briefing center, Kandidat iterasi, Key message & pillar, serta Bucket tindakan. Ringkasan hanya menyimpan jumlah kandidat dan tombol menuju menu meeting. Detail ad, daftar kandidat, center briefing, dan kelompok pesan/pillar dapat dimasukkan ke meeting. Kolom Content Pillar (AM) dibaca berdasarkan header; mapping kosong tidak ditebak.

Briefing mengurutkan center berdasarkan ad terakhir aktif yang direkomendasikan kill, masalah CPR / penurunan hasil dan kenaikan biaya, lalu spend. Perbandingan tren memakai periode sebelumnya sepanjang rentang tanggal pilihan, dengan hari lengkap dan konteks sebanding; data kosong tidak dianggap nol. Preset tujuh hari sampai kemarin memakai zona Asia/Jakarta. Tanggal sumber terbaru tetap terlihat bila data belum mencakup kemarin.

Analisis pesan/pillar dipisah per center, brand, objective, dan result type. Biaya = total spend / total hasil. Benchmark mengecualikan seluruh ad pendukung kelompok, sebelum pencarian/key message. Pilihan Booking/CPB, Leads/CPL, Results/CPR menentukan prioritas. Sampel di bawah minimum, mapping kosong, peer yang belum lengkap, serta kelompok dengan kurang dari dua ad atau kurang dari minimum hasil kategori diberi keterangan; tidak dipaksakan menjadi winner. Materi tetap perlu ditinjau.

Bucket lokal memakai localStorage `sparks-meetings-v1`, schemaVersion 1, identitas item UUID, snapshot keputusan, daftar riwayat, dan evaluasi iterasi terpisah. Status: Untuk dibahas, Disepakati, Dikerjakan, Selesai. Keputusan di luar tahap pembahasan memerlukan PIC/deadline. Duplikasi entity aktif membuka item yang sudah ada. Edit melalui Buka/tindak lanjuti; simpan status/tindakan untuk memindahkan bucket. Tidak ada tindakan otomatis terhadap iklan Meta.

Snapshot metrics, periode, threshold, label pesan/pillar, dan waktu data tidak berubah ketika sheet sinkron. Setiap simpan menambahkan riwayat keputusan. Untuk mengevaluasi iterasi, pilih ad hasil dengan konteks center/brand/objective/result type yang sama, isi rentang tanggal dan kesimpulan, lalu centang Simpan evaluasi baru. Produksi selesai tidak otomatis membuat evaluasi berhasil; snapshot hasil baru disimpan terpisah, dengan angka per hari dan biaya hasil untuk membaca perbedaan panjang periode. Nama iklan saja bukan bukti kausal.

Ekspor cadangan menghasilkan JSON bucket beserta riwayat dan evaluasinya. Impor menambah ID baru; ID yang sudah ada tidak ditimpa. File impor dibatasi 10 MB dan divalidasi sebelum perubahan apa pun. Gagal tulis localStorage tidak mengubah state aplikasi. Konflik tab lain meminta reload. Bucket tetap bisa dibuka ketika koneksi sheet gagal. Penyimpanan browser terikat origin/profil; pindah browser, lokasi file, server lokal, atau hapus data browser berpotensi kehilangan akses. Ekspor sebelum pindah. Belum ada deployment, Firebase, login, server, atau sinkronisasi antarperangkat.

Tests: `tests/meeting.js` dan browser reload memverifikasi penyimpanan, keputusan, duplikasi, snapshot, cadangan, evaluasi, data kosong, pemetaan pillar, dan akses tanpa sheet.


Bucket memiliki tombol Hapus per item dengan konfirmasi yang menyebut judul/center dan cakupan penghapusan. Catatan, riwayat, dan evaluasi item dihapus dari localStorage, tanpa mengubah Sheet atau Meta; item hanya dapat dipulihkan dari cadangan yang sudah diekspor. Kegagalan tulis tidak menghilangkan item dari memori. Kartu Center Insights memakai komponen metrics yang sama dengan Meeting & Action: Results, Leads, Booking, CPR, CPL, CPB; data kosong ditandai dengan tanda pisah; cakupan laporan yang tersedia sebagian dapat dilihat melalui tooltip pada angka.



## Booking conversion (Leads -> Booking %)

bookingRate = total Booking / total Leads x 100. Denominator nol, data kosong, menghasilkan nilai null (ditampilkan sebagai tanda pisah). Jika sebagian baris belum lengkap, nilai untuk keputusan tetap null; tampilan Partial hanya memakai baris dengan Leads dan Booking yang sama-sama tersedia. Nol Booking dengan Leads positif adalah 0%. Penggabungan ad/center/periode menghitung ulang dari total, bukan merata-ratakan persentase baris/hari. Rasio tidak dibagi dengan jumlah hari. Kenaikan rasio menjadi hijau pada perbandingan periode; persentase perubahan bersifat relatif. Tidak ada threshold baru untuk kill atau iterasi.

Metrik tersedia pada KPI, chart center dan periode, tabel periode, Center Insights, Creative Explorer (summary/period/compare), detail ad, benchmark, main metrics Meeting & Action, analisis pillar/pesan, kandidat iterasi, snapshot/evaluasi bucket dan ekspor CSV. Snapshot lama tetap utuh; conversion diturunkan hanya dari angka Leads/Booking snapshot yang diketahui. Angka >100% tidak dipotong dan perlu diperiksa tanggal/atribusi, karena rasio periode ini bukan pelacakan cohort orang yang sama.

## Multi-account import

Impor awal 28 Oktober?4 November sudah diterapkan pada spreadsheet Centers. Tiga tab Import memisahkan SE Main, SE Secondary, dan SLSA; Creative Mapping melindungi label dari pembaruan export. Lihat [panduan impor](import-workflow/README.md) dan [aktivasi satu kali](import-workflow/Activate-Import.html). Custom menu Apps Script belum aktif sampai pengguna menjalankan setup dan otorisasi Google.

## Account experiments

The Account filter defaults to All Accounts and applies to overview metrics, center insights, creative tables, alerts, historical period comparisons, meeting analysis, and CSV exports. Main/Secondary labels appear on creative and meeting records. Saved bucket snapshots retain their original account scope.

Overview includes Account Comparison (Spend, Results, Leads, Booking, CPR/CPL/CPB, both conversion rates) and Account Trends with a shared chart scale and daily/weekly/monthly controls. Comparisons split center, brand, objective and result type. Combined cost ratios use total spend divided by total outcomes. Missing data stays unavailable; relative CPR differences are descriptive, not automatic experiment winners.

Daily Report optional identifiers are English AA:AE and SLSA F:J: Account Group, Account ID, Campaign ID, Ad Set ID, Ad ID. Native matching prefers account/ad IDs, then explicitly assigned account groups on ID-less report rows, then unassigned legacy reports only when the raw match is unique. Existing account/ID blanks are not guessed. Use the latest import-workflow/SparksImport.gs if the earlier script was already installed.


## Partial outcome reports

English Daily Report ad sets with the `_TA` token are assigned to Third during Report Totals matching when Account Group is blank. Explicit account metadata wins. Report alias `CL.JU_T_D_W_TA` matches Raw Data `ALLS-ENG-JU_T_D_W_TA`, with date and creative code still required. The live sheet handles this alignment before the dashboard reads Raw Data. Account-free legacy totals exclude these inferred Third reports. Original names, IDs and outcomes are retained, and unresolved duplicate matches stay unknown.

### Summary and ad-set reconciliation

Overview now also reads the existing Report Totals tab. Matching is scoped by date, brand, center, ad-set report key and creative code, with account/ID-specific reports preferred where available. An account may be inferred only when the entire source match belongs to one full center/account/campaign/ad-set context. Filtering one account never resolves a globally ambiguous key.

When multiple published ad names share a creative code within that proven ad set, the report outcome is counted once in Overview and the parent Ad set Performance row only if every related source row is in the selected filter/Delivery view. Child ads keep their original unknown outcomes. Search, key-message, objective or Delivery filters that exclude group members suppress recovery. Existing per-ad outcomes are never overwritten or added twice. The Google Sheet is read, not rewritten with invented ad allocations.

Summary cards use recovered group totals where proven. If coverage is still incomplete, summary ratios use only matching rows and visibly state their exact spend/outcome numerator and denominator under Matched data. Individual ad tables continue to require complete period data. Mixed CPR and Results-to-Leads appear as separate values per brand/objective/result type. Expand Summary data coverage to see recovered ad-set-level outcomes. Native report failures fall back to known ad rows with an explicit sync explanation.

Regression coverage: tests/report-summary.js and tests/summary_browser_check.py, including Main/Secondary isolation, same creative code in different centers, shared reports counted once, subset filters, and full ad-set totals reconciling to Overview.

Known Leads and Booking remain visible with a Recorded label when another ad/day has no matched Daily Report. Individual-ad CPL, CPB, Results-to-Leads and booking conversion remain unavailable until required outcome rows are matched, with Missing Leads/Booking, Ambiguous ad match, or Report not matched explaining why. Ratios from a covered subset never replace the full-period ratio. Metric tooltips expose covered row counts and dates; missing reports are never converted to zero. Overview recorded count averages divide known outcomes by all dates with source rows in that period, including dates with missing outcome reports. They do not divide by only the matched dates.

Strict completeness applies to individual-ad metrics and the seven-day action window. Overview instead exposes matched-row ratios with explicit coverage. Comparisons remain neutral whenever either side lacks complete outcome coverage. Ad detail compares Selected period vs. 7-day action metrics and lists unmatched/ambiguous report dates. Status cells expand to show the actual action metrics. Bucket snapshots retain both strict metrics and observed evidence without changing old snapshots. Regression coverage: tests/partial-metrics.js, tests/metric-integrity.js and tests/browser_check.py. See METRIC_AUDIT.md for the November 6 source audit.


## Ad set Performance in Overview

Overview has a dedicated Cost per Booking KPI. The Account Comparison table, Account Trends line charts and Center performance table are replaced by Ad set Performance; all eight center bar charts and the main period charts remain. Account filters and labels still apply throughout the dashboard.

Ad set rows group brand, account, campaign and ad set; expansion lists unique ads with separate main metrics and publish ages. Parent age shows youngest to oldest ad at the available period end. Rank by CPR, CPL, CPB, Results, Leads, Booking, Results-to-Leads or Booking conversion, in either direction. Rankings compare matching brand/objective/Results types, require the configured minimum spend, and leave incomplete reports unranked. Cost rankings treat paid delivery with a recorded zero outcome as worst, with cost shown as unavailable. Smaller costs and larger outcome counts/rates are better for the selected metric; rankings do not claim a combined winner across all metrics. Spend share is against selected spend for ad set rows and filtered ad set spend for ad rows.

Results-to-Leads target: >=80% green, <80% red, unavailable neutral. Metric values across summary/table views and center bars follow this target. Trend change backgrounds continue to indicate improvement/decline versus the previous period; the number color indicates the 80% target. This visual target does not introduce an automatic kill rule. Tests: tests/adsets.js.

Ad set Performance now displays the number of unique ads in an Ad count column. Counts follow the current filters and include active/inactive ads represented in that period. More than 7 is red, fewer than 7 green, exactly 7 neutral. This display rule does not change ad recommendations.


Ad set Performance defaults to Active ads; its Delivery selector also offers Inactive ads and All ads. Each ad is classified by its latest recorded status in the selected date range, independently of search/key-message filters. Same-day conflicting or unknown statuses are shown under All ads, not silently treated as inactive. Totals, rankings, ad age ranges and table spend shares follow the delivery selection and use the full period history of those ads.

The Active ads column counts unique active ads from the base date/account/ad set scope before search and key-message filters, independently of the Delivery selector. Its limit is 7: above 7 red, below 7 green, exactly 7 neutral. Active ads have green dots, inactive red, unknown gray; All ads sorts active ads first. This is reported period status, not live Meta inventory.


## Date shortcuts

Click Date range to choose Last 3 days, Last 7 days, Last week or Last month, or edit Start date / End date manually. Shortcuts anchor to the latest date in the entire source, not the current center filter or the computer clock. Last 3/7 days include that date; Last week is the previous complete Monday-Sunday, Last month the previous full calendar month. A selected shortcut advances when new data syncs; manual date changes switch to Custom range and stay fixed. Reset restores Last 7 days. Tests: tests/date-range.js.

Date range also includes Today, Yesterday, Last 14 days, Last 28 days, and Last 30 days. Today/Yesterday follow the Asia/Jakarta calendar even if source reports lag; an unavailable day shows no data. Last N days include the latest source day and N-1 preceding calendar days. The menu states both date references explicitly.


## Overview and assignment audit (10 November 2026)

- My assignments includes the twelve managed centers on Main/Secondary and exactly `ALLS-ENG-JU_T_D_W_TA_3/11/26` on Third. Its center is normalized to CL.JU. All assignments keeps other team members' data accessible without deleting sheet rows.
- Centers excludes C.IN. Preheat includes C.IN across the owned sources. All work combines the two; the Campaign selector narrows an exact campaign. Date range and account controls apply to all three views and their comparison history.
- Overview period tables and charts use the same verified ad-set recovery as summary cards. Results, CPR and Results-to-Leads are split by brand/objective/result type instead of disappearing when All objectives is selected. Costs remain ratios of sums, never averages of daily ratios.
- For missing reports, recorded counts and matched-row costs/conversions have explicit labels and denominator tooltips. Comparison colors require complete reports on both sides. No missing outcome becomes zero; individual-ad decisions remain strict.
- Outcome matching issues lists affected ads, dates, accounts and missing fields. Ambiguous ad match means one report matches multiple source rows; Report not matched means an available report was not applied, or report sync failed. Missing Leads/Booking means no matching report was found.
- Browser verification: `python tests/overview_audit_check.py` (live spreadsheet, Daily/Weekly/Monthly, account/ownership/preheat/campaign filters, matching arithmetic, period controls, ad-set regressions, desktop/mobile layout).


## WhatsApp grouping and concise working views (10 November 2026)

Traffic and Leads messaging use one WhatsApp reporting context and center benchmark. Original Meta objectives remain available in filters and exports. WhatsApp (Traffic + Leads) is the default objective selection. The calculations use sums of spend and outcomes; costs are not averaged across objectives. Other brands, Booking/Sales and non-messaging Results remain separate. Zero-result Traffic/Leads rows with an unknown result type contribute spend to the user-defined WhatsApp context, while their raw type stays unknown for individual-ad validation.

The workspace filter row is inset inside the filter card on desktop and mobile. Scope narration, marketing subtitles, repeated chart explanations and long instructions around operational tables were removed. Ad-set methodology is available in Data & Methodology. Date/evaluation windows, data-matching labels, action reasons and local-bucket backup information remain visible where needed.

Verification: `python tests/clean_ui_check.py` tests WhatsApp arithmetic and grouping, ownership and preheat filters, chart/period behavior, ad-set rankings, action-rule regression and filter bounds at 1600, 1000 and 390 pixels.
# Outcome matching update — 12 November 2026

Zero-activity rows before a valid ad-name publish date are excluded from dashboard analysis. Rows with actual spend, delivery or outcomes before that date preserve the entire ad history for validation; missing outcomes after publication remain unknown.

The user-approved Secondary / TBT / `TBT_T_D_W_BA_13/3/26` pair `10/10/26 - OLD_14` and `4/11/26 - OLD_14` now appears as `OLD_14 [Combined: 2 ads]` across the dashboard. The matching scope retains campaign, account, full ad set, date and result context. Spend and Results are summed, while provable shared report outcomes are counted once. Original names remain searchable and visible in the group's history panel. Active-ad capacity counts original ads. Individual publish age and kill decisions are not inferred from a combined group. Raw Data and Daily Report records remain unchanged.


13 November: the user confirmed CBN / Main Ad ID `120249097142890027` was renamed. Its full history is retained, its name date is not used as a publication date or age, and unmatched outcomes are labelled as historical outcomes for a renamed ad. Missing outcomes are not replaced with zero.

## Center content rankings ? 13 November 2026

Center Insights now starts with Content Leaders & Laggards. Select CPL or CPB and group by Content, Key message, or Pillar. All selected-period filters apply; active and inactive ads are included. Each center / brand / comparable outcome context has up to five leaders and laggards. Content pools the same creative code + message + pillar + format across selected ad sets/accounts, preserving matched outcomes and the approved OLD_14 combination. Expand evidence to inspect original ads.

Cost is ratio of sums, not mean daily costs. Only complete outcomes for the selected metric are eligible, with minimum spend from Settings. Leaders require the configured minimum outcome count (default 5) and cost below other complete mapped groups combined. Laggards have higher cost, or confirmed zero outcomes at minimum spend. Peer benchmark excludes the candidate, needs minimum spend and outcomes; missing data is not zero. Blank message/pillar groups cannot rank at that label level. Ties and insufficient peers are not forced into winners/losers. This historical comparison does not change seven-day kill/iterate rules.

Verification: `python tests/content_ranking_check.py` checks arithmetic, missing data, benchmark scope, top-five caps, independent CPL/CPB coverage, grouping, live controls and responsive layout.

## Center card coverage fix ? 13 November 2026

Removed Center benchmarks from Center Insights. Center cards now use the same scoped recovery and matched-data display as Overview. Shared outcomes are recovered only at proven report scope and counted once; individual ads remain unchanged. Partial CPL/CPB use spend on rows with the relevant outcome. Booking conversion uses rows where both Leads and Booking are recorded. Matched-data labels and expandable Report coverage show the denominator, matched rows and dates; missing data is never coerced to zero. A zero-result WhatsApp row with no raw result type no longer forces the entire center's summary badge into validation when its business outcome context is otherwise known. Action rules and content-ranking eligibility remain unchanged.

Verification: `python tests/center_cards_check.py`: 14 center-card checks, 31 report-summary regressions, 24 content-ranking regressions; live cards compared with Overview; desktop/mobile layout checked. The Nov 1?10 live check still has 7 unmatched CBN daily rows for the confirmed renamed IAFSCNG_46 ad; partial card values do not resolve those missing historical outcomes.

## Business cost targets supersede relative winner/loser labels ? 13 November 2026

The shared CostTargets policy uses inclusive maximum CPR Rp30,000, CPL Rp40,000 and CPB Rp300,000, configurable in Settings. Existing stored settings retain defaults for the new CPL/CPB fields. Rankings now classify by business target first and sort by selected cost; peers are context only. Two good creatives may both qualify; Worst remains empty if all eligible creatives meet target. Minimum spend and minimum outcome counts remain required for leaders, missing reports never become zero, and brands/centers/Results contexts remain isolated.

The policy applies to content/message/pillar rankings, ad-set heatmaps and rank badges, creative comparison heatmaps, shared metric output, center charts/cards, and Meeting iteration/message/pillar learning. Iteration accepts enough within-target outcomes without requiring a cheaper-than-peer frontier. Operational rules use version main-metrics-v4-targets and still evaluate the last seven days. Generic cost review checks use fixed business targets; CPB within target also protects K1/K3 even when peers are cheaper. No new cost-only kill rule is added; K2/K4/K5, completeness, delivery and age checks remain.

Historical period-change colors continue to compare prior periods, and stored meeting snapshots remain historical records. CSV/Sheet source metrics are not edited to change the ranking. Supersedes the relative-benchmark ranking and iteration descriptions in earlier sections.

Verification: tests/cost_targets_check.py covers the supplied IEXBE_13 screenshot (CPL rounded Rp9,220, CPB Rp36,169), an actual live MKS ranking, target boundaries and settings, action regressions, center summaries, and all navigation views.

## Center-relative generators ? 13 November 2026

Supersedes the target-only ranking eligibility above. A CPL/CPB leader can qualify by fixed target OR by a qualified center-average cost, with minimum spend and minimum outcome count unchanged. Costs above fixed targets remain red (including a red cost-cell background in Top); the reason states Within center average. Worst requires failing both cost references, or confirmed zero outcomes. If no qualified reference exists, use the fixed target and disclose the missing average. The same item cannot be Top and Worst for the same metric/scope. CPL and CPB are independent: Leads generator is not automatically a Booking generator.

Center references use sum(peer spend) / sum(peer outcomes), exclude all candidate ad identities and incomplete peer ads, and require minimum spend and outcome counts. They respect the date/center/brand/Results/account/campaign/role scope, pool selected accounts and ad sets, and are not narrowed by search/key-message filters. Labels need not be filled for peer ads to support cost arithmetic. Content ranks use selected-period base rows; operational iteration uses the seven-day action scope. Iteration and Meeting pillar/message learning share the center-reference helper. Existing delivery, age, funnel and kill checks remain; being a historical generator is not approval to keep an ad running.

Top sort offers Lowest cost or Most Leads/Most Booking. Worst remains zero outcomes first then highest cost. All three costs are visible in ranked rows. Fixed limits remain inclusive and configurable. The ranking lists are views, not automatic additions to the persistent meeting bucket.

Verification: tests/hybrid_ranking_check.py includes center-relative eligibility, independent outcome coverage, center/brand/account scope, no candidate leakage, above-target red backgrounds, generator sorting and the live MKS regression.

## Additional date presets ? 13 November 2026

Date range includes MTD (first day of the latest-source-data month through the latest data date), Last month + MTD (first day of the prior month through that date), and Last 4 W (four completed Monday?Sunday weeks before the week containing that date). Last 28 days remains a distinct rolling range. Presets remain selected across sync and use the existing rolling-range behavior. Custom dates are unchanged. `tests/date_presets_check.py` verifies calendar boundaries and live shortcut clicks.

## Center performance by period

Center Insights starts with a center-by-period comparison. Choose Daily, Weekly or Monthly and a metric pair (Leads/CPL, Booking/CPB, Results/CPR, conversions, or Spend). The global date range and all assignment/account/campaign filters still apply. Four periods are shown at a time; earlier/later buttons navigate the selected range. Both metric tables share one center order and can sort by the latest displayed period. Brands have separate rows; centers with history but no selected-period data remain blank.

Week labels come from Raw Data's Week Num, with selected dates below. Count metrics offer totals or daily averages; costs/conversions are always ratios of pooled totals. The change column compares the latest visible period with the preceding calendar period inside the selected range, aligning weekdays (weekly) or day numbers (monthly), and displays both comparison values. Missing days/outcomes, conflicting week labels and incompatible Results contexts are not scored. Available partial values have an asterisk and expandable coverage details. Shared reports are recovered once at their proven scope. Color uses operational thresholds; it does not create center monthly targets or change ad actions.

Validation: `tests/center-periods.js` covers calendar alignment, center/account/brand isolation, zero/missing outcomes and shared reports. `tests/center_periods_check.py` runs these plus existing scorecard tests in isolated Chromium, reconciles live cells with the existing summary, exercises all view/metric controls, and checks desktop/mobile layouts.
