/* Main-metric action rules v7. Historical table metrics stay separate from action evidence. */
const Rules=(()=>{
  const VERSION='main-metrics-v7-k5-healthy-funnel';
  const identity=A.adIdentity;
  // User confirmed this specific ad was renamed; its name date is not its publication date.
  const confirmedRenamed=r=>r.brand==='English'&&r.account==='Main'&&r.center==='CBN'&&String(r.raw?.['Ad ID']||'')==='120249097142890027';
  const setKey=r=>JSON.stringify([r.brand,r.account,r.campaign,r.adset]);
  const contextKey=r=>JSON.stringify([r.center,A.metricContext(r)]);
  const dayOffset=(day,n)=>{const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  function published(ad){
    const m=String(ad).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s*-/);if(!m)return null;
    const year=+m[3]+(m[3].length===2?2000:0),day=`${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`,d=new Date(day+'T00:00:00Z');
    return Number.isNaN(+d)||d.toISOString().slice(0,10)!==day?null:day;
  }
  function index(rows,account='ALL'){
    const ads=new Map(),spend=new Map(),centers=new Map(),sets=new Map();let latest='';
    for(const r of rows){if(!r.day)continue;
      for(const [map,key] of [[ads,identity(r)],[centers,contextKey(r)],[sets,setKey(r)]]){if(!map.has(key))map.set(key,[]);map.get(key).push(r);}
      const key=setKey(r)+'|'+r.day;spend.set(key,(spend.get(key)||0)+r.spend);if(r.day>latest)latest=r.day;
    }
    return {ads,spend,centers,sets,latest,account};
  }
  function history(s,idx){
    const first=s.items?.[0];if(!first)return {ageDays:null,activeDays:0,published:null,asOf:null,lowShareDays:0,fourRows:[],timeline:[]};
    const asOf=s.end&&s.end<idx.latest?s.end:idx.latest,all=(idx.ads.get(identity(first))||[]).filter(r=>r.day<=asOf).sort((a,b)=>a.day.localeCompare(b.day));
    const renamed=all.some(confirmedRenamed),pub=renamed?null:published(first.ad),firstDelivery=all.find(r=>r.spend>0||r.impressions>0||r.results>0)?.day||null;
    const publishConflict=!!(pub&&firstDelivery&&pub>firstDelivery),validPub=pub&&pub<=asOf&&!publishConflict?pub:null,activeDays=new Set(all.filter(r=>r.status==='active').map(r=>r.day)).size;
    const timeline=A.group(all,r=>r.day).sort((a,b)=>a.key.localeCompare(b.key));
    const lastSeen=all.at(-1)?.day||null,statuses=new Set(all.filter(r=>r.day===lastSeen).map(r=>String(r.status||'').trim().toLowerCase()));
    const lastStatus=statuses.size===1?[...statuses][0]:'unknown';
    return {renamed,published:validPub,reportedPublish:pub,firstDelivery,publishConflict,invalidPublish:!!pub&&!validPub,ageDays:validPub?Math.floor((Date.parse(asOf)-Date.parse(validPub))/86400000)+1:null,activeDays,asOf,firstSeen:all[0]?.day||null,lastSeen,lastStatus,lowShareDays:0,fourRows:[],timeline:timeline.map(g=>({day:g.key,status:[...new Set(g.items.map(r=>r.status||'unknown'))].join(', ')}))};
  }
  function previousMonth(asOf){const d=new Date(asOf+'T00:00:00Z'),iso=x=>x.toISOString().slice(0,10);return {start:iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1))),end:iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),0)))};}
  function evaluate(s,unusedPeers,idx,config){
    const h=history(s,idx),first=s.items?.[0],reasons=[],actions=[],kills=[],warnings=[],blocks=[],protectedReasons=[];
    if(!first||!h.asOf)return {...s,state:'EMPTY',history:h,killReasons:[],ruleWarnings:[],creativeEvaluation:false,diagnosis:{reasons:['Belum ada data.'],actions:['Tunggu data.']}};
    const desiredStart=dayOffset(h.asOf,-6),start=h.published&&h.published>desiredStart?h.published:desiredStart;
    const own=(idx.ads.get(identity(first))||[]).filter(r=>r.day>=start&&r.day<=h.asOf);
    const stats=A.aggregate(own),accountMatch=r=>!idx.account||idx.account==='ALL'||(r.account||'Unknown')===idx.account;
    const centerRows=(idx.centers.get(contextKey(first))||[]).filter(r=>accountMatch(r)&&identity(r)!==identity(first));
    const peers=centerRows.filter(r=>r.day>=start&&r.day<=h.asOf),center=A.aggregate(peers),month=previousMonth(h.asOf),monthStats=A.aggregate(centerRows.filter(r=>r.day>=month.start&&r.day<=month.end));
    const monthlyReady=monthStats.results>=config.minResults&&monthStats.spend>=config.minSpend&&monthStats.cpr>0&&!monthStats.mixed;
    const centerBookingReady=center.bookingRows===center.rows&&center.booking>0&&center.spend>=config.minSpend&&center.results>=config.minResults&&!center.mixed;
    const setRows=(idx.sets.get(setKey(first))||[]).filter(r=>r.day>=start&&r.day<=h.asOf),denom=setRows.reduce((n,r)=>n+r.spend,0);
    const op={...s,...stats,items:own,start,end:h.asOf,share:A.ratio(stats.spend,denom,100),benchmark:center,history:h,grain:'summary',partial:false,lastDelivery:h.lastStatus,lastDay:h.lastSeen};
    // An earlier evaluation window must never leak into a new one.
    delete op.operational;delete op.actionEvidence;
    const valid=!stats.mixed&&own.every(r=>r.resultType&&r.resultType!=='Tidak tercatat'),active=h.lastStatus==='active';
    const leadsComplete=stats.rows>0&&stats.leadRows===stats.rows,bookingComplete=stats.rows>0&&stats.bookingRows===stats.rows;
    const eligible=stats.spend>=config.minSpend,rateReady=leadsComplete&&stats.results>=config.minResults&&Number.isFinite(stats.leadRate);
    const age=h.ageDays,ageKnown=Number.isFinite(age),moneyText=n=>'Rp'+Math.round(n).toLocaleString('id-ID'),rateText=n=>n.toLocaleString('id-ID',{maximumFractionDigits:2})+'%';
    const daily=A.group(own,r=>r.day),fourDays=Array.from({length:4},(_,i)=>dayOffset(h.asOf,-i));
    const zeroFour=fourDays.every(day=>{const g=daily.find(x=>x.key===day);return !!g&&g.results===0;})&&daily.filter(g=>fourDays.includes(g.key)).some(g=>g.spend>0);
    const protectedBooking=bookingComplete&&stats.booking>0&&stats.cpb<=500000&&(CostTargets.meets(stats.cpb,'cpb',config)||centerBookingReady&&stats.cpb<=center.cpb);
    // K5 uses the same seven-day green thresholds as the displayed main metrics.
    // Incomplete Leads or an undefined ratio must not be treated as green.
    const k5HealthyFunnel=leadsComplete&&CostTargets.meets(stats.cpr,'cpr',config)&&CostTargets.meets(stats.cpl,'cpl',config)&&Number.isFinite(stats.leadRate)&&stats.leadRate>=80;
    let k5Review=false;
    const guardBooking=(code,text)=>{
      if(!bookingComplete){blocks.push('Booking belum lengkap untuk memeriksa pengecualian '+code+'.');return;}
      if(protectedBooking){protectedReasons.push(`${code}: ${text} Namun ${stats.booking} Booking, CPB ${moneyText(stats.cpb)} memenuhi target ${moneyText(CostTargets.limit('cpb',config))} atau benchmark center; prioritas review.`);return;}
      if(stats.booking>0&&!centerBookingReady){protectedReasons.push(`${code}: ${text} Sudah ada ${stats.booking} Booking, tetapi benchmark CPB center belum cukup untuk memeriksa pengecualian; prioritas review.`);return;}
      kills.push({code,text});
    };
    if(active&&valid&&eligible){
      if(rateReady&&stats.leadRate<60)guardBooking('K1',`Results to Leads ${rateText(stats.leadRate)} <60% (${stats.leads} Leads / ${stats.results} Results).`);
      if(ageKnown&&age>3&&zeroFour)kills.push({code:'K2',text:`Umur ${age} hari; 0 Results pada 4 hari kalender berturut-turut (${dayOffset(h.asOf,-3)} - ${h.asOf}), dengan spend. Spend share ${op.share===null?'-':rateText(op.share)}.`});
      if(ageKnown&&age>3&&op.share>1&&stats.results>=1&&stats.results<config.minResults){
        if(!monthlyReady)protectedReasons.push('K3: Results masih '+stats.results+' dan spend share >1%, tetapi benchmark CPR bulan sebelumnya belum cukup; prioritas review.');
        else if(stats.cpr>2*monthStats.cpr)guardBooking('K3',`${stats.results} Results; CPR ${moneyText(stats.cpr)} >2x CPR center ${moneyText(monthStats.cpr)} pada ${month.start} - ${month.end}; umur ${age} hari dan spend share ${rateText(op.share)} >1%.`);
      }
      if(ageKnown&&age>=7&&rateReady&&stats.leadRate<70){
        if(!bookingComplete)blocks.push('Booking belum lengkap untuk K4.');
        else if(stats.booking===0)kills.push({code:'K4',text:`Umur ${age} hari >=7; Results to Leads ${rateText(stats.leadRate)} <70%, ${stats.results} Results, 0 Booking.`});
      }
      if(bookingComplete&&stats.booking>0&&stats.cpb>500000){
        if(k5HealthyFunnel){
          k5Review=true;
          protectedReasons.push(`K5: CPB ${moneyText(stats.cpb)} >Rp500.000 (${stats.booking} Booking), tetapi CPR ${moneyText(stats.cpr)} ≤${moneyText(CostTargets.limit('cpr',config))}, CPL ${moneyText(stats.cpl)} ≤${moneyText(CostTargets.limit('cpl',config))}, dan Results to Leads ${rateText(stats.leadRate)} ≥80% pada 7 hari evaluasi. Prioritas review, bukan rekomendasi kill; pantau peluang Booking pada periode berikutnya.`);
        }else kills.push({code:'K5',text:`CPB ${moneyText(stats.cpb)} >Rp500.000; ${stats.booking} Booking pada periode evaluasi, sementara CPR, CPL, atau Results to Leads belum semuanya memenuhi target. Tidak dibatalkan oleh rata-rata center.`});
      }
    }
    // Shared outcomes cannot establish an individual ad's kill evidence.
    if(first.combinedNames)kills.length=0;
    const warn=(rule,text,action,high=false)=>{warnings.push({rule,text,high});actions.push(action);};
    if(stats.ctr!==null&&stats.ctr<1)warn('ctr',`CTR ${rateText(stats.ctr)} <1%.`,'Evaluasi visual, headline, penawaran, dan CTA.');
    if(stats.hook!==null&&stats.hook<=25)warn('hook',`Hook rate ${rateText(stats.hook)} <=25%.`,'Evaluasi opening video; di bawah 10% menjadi prioritas creative.',stats.hook<10);
    if(stats.view!==null&&stats.view<=30)warn('view',`Views rate ${rateText(stats.view)} <=30%.`,'Evaluasi durasi dan urutan pesan; di bawah 10% menjadi prioritas creative.',stats.view<10);
    if(stats.frequency!==null&&stats.frequency>3)warn('frequency',`Frequency ${stats.frequency.toFixed(2)} >3.`,'Periksa kejenuhan audience dan kebutuhan variasi creative.');
    let state='MONITOR',opportunities=[],iterationBenchmark=null,iterationBenchmarkCosts=null;
    if(!stats.rows||!stats.spend){state='EMPTY';reasons.push('Tidak ada spend dalam jendela evaluasi.');}
    else if(h.lastStatus==='inactive'){state='INACTIVE';reasons.push('Status terakhir inactive; tidak diberi rekomendasi tindakan baru.');}
    else if(!active||!valid){state='MIXED';reasons.push('Status penayangan atau jenis Results belum dapat divalidasi.');}
    else if(first.combinedNames){state='MIXED';reasons.push('Shared outcomes: '+first.combinedNames.length+' original ads are evaluated as one content group. Review the original ads before a kill or delivery decision.');}
    else if(kills.length){state='KILL';reasons.push(...kills.map(k=>k.code+': '+k.text));actions.unshift('Tinjau bukti main metrics dan lakukan kill / pause secara manual.');}
    else if(!eligible){state='SAMPLE';reasons.push(`Spend ${moneyText(stats.spend)} belum mencapai ${moneyText(config.minSpend)}; tidak ada pengecualian minimum spend.`);}
    else if(blocks.length||!leadsComplete||!bookingComplete||!ageKnown){state='MIXED';reasons.push(...blocks);if(!leadsComplete||!bookingComplete)reasons.push('Laporan Leads / Booking belum lengkap; angka kosong tidak dianggap nol.');if(!ageKnown)reasons.push('Tanggal publish belum valid untuk aturan berbasis umur.');}
    else if(k5Review){state='CRITICAL';reasons.push(...protectedReasons);}
    else if(stats.cpb>400000){state='CRITICAL';reasons.push(`CPB ${moneyText(stats.cpb)} >Rp400.000 dan ≤Rp500.000; review biaya Booking.`);}
    else if(protectedReasons.length){state='CRITICAL';reasons.push(...protectedReasons);}
    else if(stats.cpb>300000){state='WATCH';reasons.push(`CPB ${moneyText(stats.cpb)} >Rp300.000 dan ≤Rp400.000; peringatan biaya Booking.`);}
    else if(stats.results<config.minResults){state='SAMPLE';reasons.push(`Results ${stats.results} belum mencapai ${config.minResults}; belum memenuhi aturan kill.`);}
    else {
      const candidate=Iteration.select([{...op,state:'MONITOR'}],setRows,config,[...own,...peers])[0];
      opportunities=candidate?.opportunities||[];iterationBenchmark=candidate?.iterationBenchmark||null;iterationBenchmarkCosts=candidate?.iterationBenchmarkCosts||null;
      if(opportunities.length){
        state=op.share!==null&&op.share<1?'OPPORTUNITY':'ITERATE';
        reasons.push(...opportunities.map(o=>o.reason));
        if(state==='OPPORTUNITY')reasons.unshift(`Spend share ${rateText(op.share)} <1%, dengan hasil dan biaya yang unggul di ad set.`);
      }else if(stats.cpr>config.target||stats.leadRate<80||(stats.cpl>CostTargets.limit('cpl',config))||(stats.cpb>CostTargets.limit('cpb',config))){
        state='CRITICAL';if(stats.cpr>config.target)reasons.push(`CPR ${moneyText(stats.cpr)} >target ${moneyText(config.target)}.`);if(stats.leadRate<80)reasons.push(`Results to Leads ${rateText(stats.leadRate)} <80%.`);if(stats.cpl>CostTargets.limit('cpl',config))reasons.push(`CPL melebihi target ${moneyText(CostTargets.limit('cpl',config))}.`);if(stats.cpb>CostTargets.limit('cpb',config))reasons.push(`CPB melebihi target ${moneyText(CostTargets.limit('cpb',config))}.`);
      }else reasons.push('Main metrics belum memenuhi kill dan belum unggul untuk iterate; lanjutkan monitoring.');
    }
    const creativeEvaluation=active&&state!=='KILL'&&warnings.length>0;
    const prefix=`Evaluasi ${start} - ${h.asOf}: spend ${moneyText(stats.spend)}, ${stats.results} Results, ${leadsComplete?stats.leads:'belum lengkap'} Leads, ${bookingComplete?stats.booking:'belum lengkap'} Booking.`;
    reasons.unshift(prefix);
    if(h.publishConflict)reasons.push(`Tanggal nama ad ${h.reportedPublish} lebih baru dari penayangan pertama ${h.firstDelivery}; umur belum dapat dipastikan.`);
    if(creativeEvaluation)reasons.push(...warnings.map(w=>'Evaluasi creative: '+w.text));
    if(!creativeEvaluation)actions.length=0;
    const mainAction={KILL:'Tinjau alasan dan pause manual di Meta.',CRITICAL:'Periksa CPR, CPL, CPB, kualitas Leads dan tindak lanjut Booking.',OPPORTUNITY:'Periksa distribusi spend dan ad lain dalam ad set sebelum menambah delivery.',ITERATE:'Iterate satu perubahan dari creative dengan hasil utama yang unggul.',MONITOR:'Pantau perubahan main metrics pada evaluasi berikutnya.',SAMPLE:'Kumpulkan spend dan Results yang cukup.',MIXED:'Lengkapi laporan, status dan tanggal publish sebelum mengambil tindakan.',INACTIVE:'Gunakan data ini sebagai referensi historis.',EMPTY:'Tunggu data penayangan.'};
    actions.unshift(mainAction[state]);
    return {...s,state,lastDelivery:h.lastStatus,lastDay:h.lastSeen,history:h,operational:{...op,state},actionEvidence:{version:VERSION,start,end:h.asOf,ageDays:age,active,zeroFour,monthly:{...month,ready:monthlyReady,cpr:monthStats.cpr,spend:monthStats.spend,results:monthStats.results,days:monthStats.days.size},centerBookingReady,centerCpb:center.cpb,protectedBooking,k5HealthyFunnel,k5Review,killCodes:kills.map(k=>k.code)},opportunities,iterationBenchmark,iterationBenchmarkCosts,creativeEvaluation,ruleWarnings:warnings,killReasons:kills.map(k=>k.code+': '+k.text),diagnosis:{reasons,actions}};
  }
  return {VERSION,identity,setKey,published,confirmedRenamed,index,history,evaluate,previousMonth,dayOffset};
})();
let ruleIndex=null;
function applyRules(s,peers){return Rules.evaluate(s,peers,ruleIndex||Rules.index(rows),config);}
function needsReview(g){return g.lastDelivery==='active'&&(['KILL','CRITICAL','WATCH','MIXED'].includes(g.state)||g.creativeEvaluation);}
function metricIntegrityMethodology(){const keys=new Map();for(const r of rows){const k=r.raw?.['Report Key'];if(k)keys.set(k,(keys.get(k)||0)+1);}const missing=rows.filter(r=>r.leads===null||r.booking===null),ambiguous=missing.filter(r=>(keys.get(r.raw?.['Report Key'])||0)>1);return `<section class="card method" style="margin-bottom:20px"><h3>Metric consistency & report matching</h3><p>Daily Report row present with empty Leads/Booking: confirmed zero. Report row absent: unresolved name match, never assumed zero. Renamed ads use verified old-code mappings scoped to Ad ID, account, center, ad set and dates; the Daily Report template does not need to change.</p><p>Seluruh sumber: ${integer(missing.length)} baris belum memiliki Leads/Booking lengkap. ${integer(ambiguous.length)} di antaranya berbagi Report Key dengan baris lain; ${integer(missing.length-ambiguous.length)} lainnya perlu diperiksa ke Daily Report.</p><ul><li>Results to Leads = total Leads / total Results x 100%. Booking conversion = total Booking / total Leads x 100%. CPR/CPL/CPB = total spend / total hasil. Rasio dihitung ulang dari total pada periode yang sama.</li><li>Leads/Booking yang belum lengkap tetap menampilkan jumlah Recorded. CPL, CPB dan conversion periode ditampilkan Incomplete, tanpa warna penilaian. Rasio dari sebagian hari tidak menggantikan rasio seluruh periode.</li><li>Beberapa ad dapat memakai kode creative yang sama meskipun tanggal publish berbeda. Daily Report dengan kode pendek saja tidak cukup untuk mengalokasikan Leads/Booking ke masing-masing ad. Gunakan Account ID dan Ad ID pada kedua sumber atau mapping yang sudah diverifikasi. Hasil tidak dibagi berdasarkan spend dan tidak disalin ke semua ad.</li><li>Booking mengikuti Bookings by Booking Date dari Daily Report; tanggalnya bisa berbeda dari tanggal Results atau Leads. Frequency tetap estimasi berbobot impressions, karena Reach deduplikasi tidak tersedia.</li><li>Overview dan parent Ad set Performance memakai total Report Totals pada tingkat ad set bila center/account/ad set dapat dipastikan dan seluruh ad terkait ada dalam filter. Hasil bersama dihitung sekali, tanpa dibagikan ke child ad. Summary yang masih belum lengkap menampilkan Matched data beserta pembilang/penyebut; CPR campuran dirinci per jenis Results.</li><li>Detail ad menyediakan pilihan Daily dan Weekly dalam rentang tanggal dashboard, dengan urutan main metrics mengikuti Ad set Performance. Weekly mengikuti Week Num. Perubahan membandingkan angka pada baris sebelumnya yang terlihat, tanpa mengambil tanggal tersembunyi. Period totals membandingkan total; Daily averages mengubah angka utama dan pembanding menjadi rata-rata per hari. Biaya tetap dihitung dari total spend/hasil, dan perubahan conversion memakai percentage points (pp). Dasar rekomendasi 7 hari tersedia terpisah di Action metrics. Ekspor menyertakan tanggal evaluasi dan jumlah baris laporan yang tersedia. Snapshot bucket lama tetap merekam kondisi saat disimpan.</li></ul></section>`;}
function actionStatus(g){const e=g.actionEvidence,o=g.operational;return pill(g.state)+(g.creativeEvaluation?'<span class="pill EVALUATE creative-flag">Evaluasi creative</span>':'')+(e?`<small class="action-window">Action window<br>${esc(e.start)} – ${esc(e.end)}</small>${o?`<details class="action-evidence"><summary>7-day action metrics</summary><div><small>Spend <b>${money(o.spend)}</b> · Share <b>${percent(o.share)}</b></small><small>Results <b>${integer(o.results)}</b> · CPR <b>${money(o.cpr)}</b></small><small>Leads <b>${displayMetric(o,'leads',integer)}</b> · CPL <b>${displayMetric(o,'cpl',money)}</b></small><small>Booking <b>${displayMetric(o,'booking',integer)}</b> · CPB <b>${displayMetric(o,'cpb',money)}</b></small><small>Results → Leads <b>${displayMetric(o,'leadRate',percent)}</b></small></div></details>`:''}`:'');}
function metricScopeComparison(g){return renderAdPeriods(g);}
function reportMatchingPanel(g){const missing=g.items.filter(r=>r.leads===null||r.booking===null);if(!missing.length)return '';return `<details class="report-matching"><summary>Report coverage: ${g.rows-missing.length}/${g.rows} rows complete</summary><p class="mini-note">Tanggal berikut belum memiliki Leads/Booking yang dapat dicocokkan ke ad ini. Kode creative yang dipakai beberapa ad membutuhkan Ad ID agar hasil tidak dihitung berulang.</p><div class="table-wrap"><table><thead><tr><th>Date</th><th>Report key</th><th>Reason</th></tr></thead><tbody>${missing.map(r=>{const key=r.raw?.['Report Key'],matches=key?rows.filter(x=>x.raw?.['Report Key']===key):[];return `<tr><td>${esc(r.day)}</td><td>${esc(key||r.adCode)}</td><td>${matches.length>1?`${matches.length} source rows share this report key; Ad ID or a verified mapping is needed.`:'No matched Leads / Booking report.'}</td></tr>`;}).join('')}</tbody></table></div></details>`;}
function ageCell(g){if(g.items?.some(r=>r.combinedNames))return 'Combined ads';const h=g.history;return h?.ageDays!==null&&h?.ageDays!==undefined?`${h.ageDays} hari`:'-';}
function historyPanel(g){const h=g.history;if(!h)return '';const combined=g.items?.find(r=>r.combinedNames);if(combined)return `<section class="diagnosis"><h3>Combined creative &middot; ${combined.combinedCount||combined.combinedNames.length} ads</h3><p>${combined.combinedNames.map(esc).join('<br>')}</p><p>Spend and Results are summed. Shared Leads and Booking are counted once. Active-ad capacity counts the original ads. Individual age and kill decisions cannot be inferred from combined outcomes.</p></section>`;return `<section class="diagnosis"><h3>Ad age & delivery history</h3><p class="mini-note">Publish: <b>${prettyDate(h.published)}</b> &middot; umur: <b>${ageCell(g)}</b>, hingga ${prettyDate(h.asOf)}. Hari publish dihitung hari ke-1.<br>${h.activeDays} hari tercatat active. Status terakhir ${esc(h.lastStatus||'unknown')} pada ${prettyDate(h.lastSeen)}.</p>${h.renamed?`<p class="notice">Renamed ad. The date in its name is not a verified publish date. Recorded delivery starts ${esc(h.firstDelivery||h.firstSeen)}; earlier performance is retained.</p>`:""}${h.publishConflict?`<p class="notice">Publish date needs review: ad name ${esc(h.reportedPublish)}, delivery recorded from ${esc(h.firstDelivery)}.</p>`:""}<details><summary>Delivery history</summary><div class="table-wrap"><table><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>${h.timeline.map(r=>`<tr><td>${r.day}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table></div></details></section>`;}
function assessmentPanel(g){const o=g.operational,e=g.actionEvidence;if(!o||!e)return '';return `<section class="diagnosis"><h3>Action evaluation &middot; last 7 days</h3><p>${esc(e.start)} - ${esc(e.end)} &middot; ${esc(e.version)}</p><div class="detail-metrics">${[['Spend',money(o.spend)],['Results',integer(o.results)],['Leads',displayMetric(o,'leads',integer)],['Results to Leads',displayMetric(o,'leadRate',percent)],['CPR',money(o.cpr)],['CPL',displayMetric(o,'cpl',money)],['Booking',displayMetric(o,'booking',integer)],['CPB',displayMetric(o,'cpb',money)],['Spend share',percent(o.share)]].map(([k,v])=>`<div><small>${k}</small><b>${v}</b></div>`).join('')}</div><p class="mini-note">CPR center bulan sebelumnya (${e.monthly.start} - ${e.monthly.end}): ${e.monthly.ready?money(e.monthly.cpr):'benchmark belum cukup'}; ${integer(e.monthly.results)} Results, ${money(e.monthly.spend)}, ${e.monthly.days} hari dengan data. Ad ini dikeluarkan. Benchmark CPB center periode evaluasi: ${e.centerBookingReady?money(e.centerCpb):'belum cukup'}. ${e.protectedBooking?'Booking dan CPB memenuhi pengecualian review untuk K1/K3.':''}</p></section>`;}
function metricRuleColor(s,key){
  if(!s)return '';const v=s[key];if(v===null||v===undefined)return '';
  if(key==='cpb')return ({good:'good-heat',warning:'warn-heat',review:'review-heat',bad:'bad-heat'})[CostTargets.cpbTier(v)]||'';
  if(CostTargets.limit(key,config))return CostTargets.meets(v,key,config)?'good-heat':'bad-heat';
  if(key==='leadRate')return v>=80?'good-heat':'bad-heat';
  if(key==='ctr')return v>=1?'good-heat':'warn-heat';
  if(key==='hook')return v>25?'good-heat':v<10?'bad-heat':'warn-heat';
  if(key==='view')return v>30?'good-heat':v<10?'bad-heat':'warn-heat';
  if(key==='frequency')return v<=3?'good-heat':'warn-heat';
  if(key==='share')return v>=1?'share-heat':'warn-heat';
  return '';
}
function rulesMethodology(){return `<section class="card method" style="margin-bottom:20px"><h3>Main-metric action rules</h3><p>Rekomendasi tindakan memakai 7 hari kalender terakhir sampai tanggal akhir pilihan, dibatasi tanggal terakhir data. Ad baru memakai data sejak publish. Angka tabel umum tetap mengikuti rentang tanggal pilihan; detail menampilkan angka evaluasi terpisah.</p><ul><li>Hanya status terakhir active yang mendapat tindakan baru. Minimum spend <b>${money(config.minSpend)}</b> berlaku untuk semua kill. Tidak ada pengecualian spend share 4 hari. Rasio Results to Leads untuk kill membutuhkan minimal <b>${config.minResults} Results</b>. Data kosong tidak dianggap nol.</li><li><b>K1:</b> Results to Leads &lt;60%. Booking dengan CPB &le;target ${money(CostTargets.limit('cpb',config))} atau &le;benchmark center melindungi dari kill ini dan menjadi Prioritas review.</li><li><b>K2:</b> umur &gt;3 hari, ada spend, 0 Results pada 4 hari kalender berturut-turut hingga tanggal evaluasi. Keempat tanggal harus memiliki data. Berlaku untuk semua spend share.</li><li><b>K3:</b> umur &gt;3 hari, spend share &gt;1%, 1-${config.minResults-1} Results, CPR &gt;2x CPR bulanan center. Pengecualian Booking/CPB sama dengan K1.</li><li><b>K4:</b> umur &ge;7 hari, Results to Leads &lt;70%, 0 Booking.</li><li><b>K5:</b> Booking &gt;0 dan CPB &gt;Rp500.000: jika CPR &le;target, CPL &le;target dan Results to Leads &ge;80% semuanya hijau dalam 7 hari dengan Leads lengkap, statusnya Prioritas review, bukan kill. Jika tidak semua hijau, K5 tetap kill. Tidak mensyaratkan umur, tidak menggunakan rata-rata center untuk pengecualian, dan tidak membatalkan kill K1–K4. CPB kosong tidak dianggap Rp0 atau di atas batas.</li><li>Benchmark CPR memakai bulan kalender penuh sebelumnya: total spend / total Results pada center, brand, hasil bisnis (Traffic/Leads WhatsApp digabung), dan scope account yang sama, tanpa ad ini. Cukup jika spend &ge;${money(config.minSpend)} dan Results &ge;${config.minResults}. Benchmark yang belum cukup menghasilkan review untuk K3, bukan kill.</li><li>Target CPB juga melindungi dari K1/K3 meskipun peer lebih murah. Benchmark CPB alternatif untuk pengecualian memakai peer center pada jendela evaluasi yang sama, lengkap Booking, Booking &gt;0, minimum spend/Results terpenuhi. Jika sudah ada Booking tetapi benchmark CPB belum cukup, K1/K3 menjadi review. K4/K5 tetap berlaku jika memenuhi syarat.</li><li>Additional metrics tidak memicu kill dan tidak membatalkan peluang iterate. Label pendamping <b>Evaluasi creative</b>: CTR &lt;1%, Hook &le;25%, Views rate &le;30%, Frequency &gt;3. Hook/Views &lt;10% menjadi prioritas creative.</li><li>Results to Leads &lt;80% tetap merah. Jumlah active ads &gt;7 menjadi penanda kapasitas, bukan pemicu kill.</li></ul><h3>CPB tiers</h3><p>≤Rp300.000: safe. &gt;Rp300.000–Rp400.000: warning (Di atas target). &gt;Rp400.000–Rp500.000: review (Prioritas review). &gt;Rp500.000: CPB tetap merah, tetapi K5 masuk Prioritas review bila CPR, CPL, dan Results to Leads 7 hari seluruhnya hijau; jika tidak, K5 tetap kill. Status memakai data 7 hari, ad active, Booking lengkap, dan minimum spend. Aturan kill lain tetap didahulukan. Warning/review CPB tidak masuk daftar iterate otomatis. Booking nol membuat CPB tidak terdefinisi; gunakan aturan hasil nol, bukan menganggap CPB tak terbatas.</p><h3>Action statuses</h3><p>Kill didahulukan. Data/status yang tidak valid: Perlu validasi. Spend belum cukup: Data minim. Pengecualian Booking atau benchmark belum cukup: Prioritas review. Setelah data cukup, jumlah hasil minimum dan target biaya atau rata-rata center kategori terpenuhi menghasilkan Layak iterate; bila spend share &lt;1%, Prioritaskan delivery. Ad lain dengan CPR/CPL/CPB di atas target atau Results to Leads &lt;80%: Prioritas review; sisanya Monitor. Inactive dan Belum ada data tidak mendapat tindakan baru. Semua tindakan Meta tetap dilakukan manual.</p></section>`;}
