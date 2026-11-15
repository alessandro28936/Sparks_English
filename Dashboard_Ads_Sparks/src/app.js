const A=Analytics, $=id=>document.getElementById(id);
const SHEET='1rLd4NuAz9S2HqqiMUWqHXZkinYmjazgsm_mj473BfGw';
const NF=new Intl.NumberFormat('id-ID'), money=n=>n==null||!Number.isFinite(n)?'—':'Rp'+NF.format(Math.round(n)), integer=n=>n==null?'—':NF.format(Math.round(n)), percent=n=>n==null||!Number.isFinite(n)?'—':n.toLocaleString('id-ID',{maximumFractionDigits:2})+'%', decimal=n=>n==null?'—':n.toLocaleString('id-ID',{maximumFractionDigits:2});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATE={KILL:'Rekomendasi kill',EVALUATE:'Evaluasi creative',OPPORTUNITY:'Prioritaskan delivery',CRITICAL:'Prioritas review',WATCH:'Di atas target',ITERATE:'Layak iterate',MONITOR:'Monitor',INACTIVE:'Inactive',SAMPLE:'Data minim',EMPTY:'Belum ada data',MIXED:'Perlu validasi'};
const pill=s=>`<span class="pill ${s}">${STATE[s]||esc(s)}</span>`;
const VIEWS={scorecards:['Metric Scorecards','Metric Scorecards','Compare weekdays, weekly outcomes and costs.'],meeting:['Meeting & Action','Today’s decisions. Tomorrow’s learnings.','Review centers, select creatives, and turn performance insights into actions.'],overview:['Overview','From performance to your next idea.','Find creatives that need attention and ideas worth iterating.'],centers:['Center Insights','Every center tells a different story.','Compare costs, results, and messages across centers.'],messages:['Key Message Lab','The right message. The right center.','Discover message patterns from actual results and plan your next experiment.'],creatives:['Creative Explorer','Read the numbers. Understand the creative.','Explore ads, spend share, and performance against relevant benchmarks.'],alerts:['Alert Center','Know what needs attention.','Spot inefficient spend and fill gaps in creative context.'],data:['Data & Methodology','Insights you can trace.','Data sources, coverage, metric definitions, and decision rules.']};
let raw=[],rows=[],base=[],selected=[],creatives=[],view='overview',scope='MY',busy=false,loaded=false,lastSync=null,lastError='',knowledgeError='',knowledge=[],page=0,tableState='ALL',tableSort='spend',delivery='ALL',alertMode='performance',matrixMetric='cpr',rollingPeriod=true;
let config={target:30000,cplTarget:40000,cpbTarget:300000,cpbTargetVersion:2,minSpend:90000,minResults:5};
try{const saved=JSON.parse(localStorage.getItem('sparks-analysis-settings-v2')||'null');if(saved&&[saved.target,saved.minSpend,saved.minResults].every(n=>Number.isFinite(n)&&n>0))config={...config,...saved,cpbTarget:300000,cpbTargetVersion:2};}catch{}
const labels={...A.LABELS};
/* COST_TARGETS */
/* WORK_SCOPE */
/* TIME_CHARTS */
/* METRIC_SCORECARDS */
/* COMPARISON */
/* RULES */
/* AD_PERIODS */
/* ITERATION */
/* MEETING */
/* ACCOUNTS */
/* ADSETS */
/* REPORT_SUMMARY */
/* CONTENT_RANKING */
/* PRIORITIES */
/* CENTER_MAP */
/* DATE_RANGE */
/* DATA_FLOW */
let chartGrain='daily',explorerGrain='summary',periodCreatives=[],explorerWeek='ALL';
const GRAINS={summary:'Summary',daily:'Daily',weekly:'Weekly',monthly:'Monthly'};
function grainControl(kind,current,summary=false){return `<div class="scope-switch time-switch" role="group" aria-label="Tampilan waktu ${kind==='chart'?'chart':'creative'}">${Object.entries(GRAINS).filter(([k])=>summary||k!=='summary').map(([k,label])=>`<button data-grain="${k}" data-grain-kind="${kind}" class="${current===k?'selected':''}" aria-pressed="${current===k}">${label}</button>`).join('')}</div>`;}
function weekLabel(p){return `${p.weekNum===null?'Week Num kosong / tidak valid':'Week '+p.weekNum} · ${p.weekYear}`;}
function periodText(p){const dates=p.start===p.end?prettyDate(p.start):`${prettyDate(p.start)} – ${prettyDate(p.end)}`;return p.grain==='weekly'?`${weekLabel(p)} · ${dates}`:dates;}
function findCreative(id){return [...creatives,...periodCreatives,...comparisonDetails,...adsetDetails,...mapAdDetails].find(g=>String(g.id)===String(id));}
function notify(text){$('toast').textContent=text;$('toast').style.display='block';clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').style.display='none',3500);}
function jsonp(tab, query, range){
  return new Promise((resolve,reject)=>{
    const cb='sparks_'+Date.now()+'_'+Math.random().toString(36).slice(2),script=document.createElement('script');let settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);script.remove();window[cb]=()=>{};setTimeout(()=>delete window[cb],60000);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(new Error('Waktu sinkronisasi habis. Silakan coba lagi.')),30000);
    window[cb]=res=>{
      if(res?.status==='error'||!res?.table)return finish(new Error('Google Sheet tidak dapat dibaca. Periksa akses dan nama tab.'));
      const headers=res.table.cols.map((c,i)=>(c.label||`column_${i}`).trim());
      const values=res.table.rows.map(r=>({...Object.fromEntries(headers.map((h,i)=>[h,r.c?.[i]?.v??null])),_format:Object.fromEntries(headers.map((h,i)=>[h,r.c?.[i]?.f??null]))}));
      finish(null,values);
    };
    script.onerror=()=>finish(new Error('Koneksi Google Sheet gagal. Periksa koneksi dan akses spreadsheet.'));
    const params=new URLSearchParams({tqx:`responseHandler:${cb}`,sheet:tab,headers:'1',tq:query||'select *',_ts:Date.now()});if(range)params.set('range',range);
    script.src=`https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?${params}`;document.head.appendChild(script);
  });
}
function optionList(id,values,label){const el=$(id),old=el.value;el.innerHTML=`<option value="ALL">${label}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(values.includes(old))el.value=old;}
function updateOptions(){
  const eligible=rows.filter(r=>workspaceMatches(r)&&accountMatches(r));
  const centerValues=[...new Set([...eligible.map(r=>r.center),...(scope==='MY'&&workView!=='preheat'&&$('accountFilter').value==='ALL'?A.MINE:[])])].sort();
  optionList('centerFilter',centerValues,workView==='preheat'?'All preheat ad sets':'All centers');
  optionList('campaignFilter',[...new Set(eligible.map(r=>r.campaign))].sort(),'All campaigns');
  const brand=$('brandFilter').value,objective=$('objectiveFilter').value;
  optionList('resultFilter',[...new Set(eligible.filter(r=>(brand==='ALL'||r.brand===brand)&&objectiveMatches(r,objective)).map(r=>r.resultType))].sort(),'Semua jenis Results');
  const oldMessage=$('messageFilter').value;
  optionList('messageFilter',[...new Set(rows.map(r=>r.message).filter(Boolean))].sort(),'Semua key message');
  $('messageFilter').insertAdjacentHTML('beforeend','<option value="MISSING">Belum diisi key message</option>');
  if(oldMessage==='MISSING')$('messageFilter').value='MISSING';
}
async function sync(){
  if(busy)return;busy=true;$('syncButton').disabled=true;$('syncDot').className='dot waiting';$('syncStatus').textContent='Menyinkronkan Raw Data & Knowledge…';
  const results=await Promise.allSettled([jsonp('Raw Data'),jsonp('Knowledge','select A,B,C,E,F','A1:F100')]);
  try{
    if(results[0].status==='rejected')throw results[0].reason;
    const data=results[0].value;
    const required=['Ad set name','Ad name','Amount spent (IDR)','Results','Impressions','Key Message Content'];
    if(data.length&&required.some(k=>!(k in data[0])))throw new Error('Kolom wajib berubah atau hilang. Periksa header Raw Data.');
    if(!data.length)throw new Error('Raw Data kosong; data terakhir dipertahankan.');
    raw=data;rows=excludeUnpublishedRows(A.resolveTypes(A.normalize(raw)));
    reportSummaryIndex=null;reportSummaryError='';
    const firstDay=rows.map(r=>r.day).filter(Boolean).sort()[0];
    try{
      const reports=await Promise.all([jsonp('Report Totals',`select A,B,C,D,E,F where A >= date '${firstDay}'`,'A1:F90000'),jsonp('Report Totals','select G,H,I,J,K,L where G is not null','G1:L90000'),jsonp('Report Totals','select M,N,O,Q,R,S where M is not null or Q is not null','M1:S90000')]);
      const reportRecords=applyVerifiedOutcomeAliases(rows,ReportSummary.records(...reports));
      fillUniqueOutcomeReports(rows,ReportSummary.index(rows,reportRecords));
      rows=combineApprovedOutcomeAds(rows,reportRecords);
      reportSummaryIndex=ReportSummary.index(rows,reportRecords);
      annotateReportIssues(rows,reportSummaryIndex);
    }catch(e){reportSummaryError='Ad-set report totals could not be synced. Summary uses matched ad rows only.';annotateReportIssues(rows,null);}
    if(results[1].status==='fulfilled'){
      knowledge=results[1].value;knowledgeError='';
      for(const r of knowledge){const vs=Object.values(r),code=String(vs[0]||'');if(/^[A-Z]{2,3}(?:\.[A-Z]+)?$/.test(code)&&code!=='BDS'&&vs[1])labels[code]=vs[1];}
    }else knowledgeError='Knowledge belum tersinkron; definisi yang sudah dipelajari tetap digunakan.';
    updateOptions();
    const dates=rows.map(r=>r.day).filter(Boolean).sort();
    if((!loaded||rollingPeriod)&&dates.length)applyDatePreset(DATE_PRESETS[datePreset]?datePreset:'last7',false);
    lastSync=new Date();lastError='';loaded=true;
    $('periodLabel').textContent=dates.length?`Tersedia ${prettyDate(dates[0])} – ${prettyDate(dates.at(-1))}`:'Tidak ada tanggal valid';
    $('syncStatus').textContent=`Raw Data synced ${lastSync.toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'})} WIB · otomatis tiap 10 menit`;
    $('syncDot').className='dot';render();
  }catch(e){
    lastError=e.message;$('syncDot').className='dot error';$('syncStatus').textContent=`Sync gagal${lastSync?' · menampilkan data terakhir':''}: ${e.message}`;
    render();
  }finally{busy=false;$('syncButton').disabled=false;}
}
function prettyDate(day){return day?new Date(day+'T00:00:00Z').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}):'—';}
function temporalFilter(r){return (!($('startFilter').value)||r.day>=$('startFilter').value)&&(!($('endFilter').value)||r.day<=$('endFilter').value)&&!!r.day;}
function refreshData(){
  ruleIndex=Rules.index(rows.filter(workspaceMatches),$('accountFilter').value);
  const center=$('centerFilter').value,obj=$('objectiveFilter').value,type=$('resultFilter').value,role=$('roleFilter').value,brand=$('brandFilter').value,q=$('searchFilter').value.toLowerCase().trim(),msg=$('messageFilter').value;
  base=rows.filter(r=>temporalFilter(r)&&workspaceMatches(r)&&campaignMatches(r)&&(center==='ALL'||r.center===center)&&objectiveMatches(r,obj)&&(type==='ALL'||r.resultType===type)&&(role==='ALL'||r.role===role)&&(brand==='ALL'||r.brand===brand)&&accountMatches(r));
  selected=base.filter(r=>(msg==='ALL'||(msg==='MISSING'?!r.message:r.message===msg))&&(!q||`${r.ad} ${(r.combinedNames||[]).join(' ')} ${r.adCode} ${r.adset} ${r.campaign}`.toLowerCase().includes(q)));
  creatives=buildCreatives('summary');
  periodCreatives=view==='creatives'&&explorerGrain!=='summary'?buildCreatives(explorerGrain):[];
  if(explorerWeek!=='ALL'&&!periodCreatives.some(g=>g.weekKey===explorerWeek))explorerWeek='ALL';
}
function buildCreatives(grain){
  const dates=selected.map(r=>r.day).sort(),from=$('startFilter').value||dates[0],to=$('endFilter').value||dates.at(-1);
  const weeks=grain==='weekly'?A.sheetWeeks(rows):null;
  return A.group(selected,r=>JSON.stringify([r.center,r.brand,r.account,r.campaign,r.adset,r.ad,r.resultType,...A.identitySuffix(r),grain==='summary'?'':grain==='weekly'?A.sheetWeekKey(r):A.period(r.day,grain).start])).map((g,i)=>{
    const first=g.items[0],messages=[...new Set(g.items.map(r=>r.message).filter(Boolean))],pillars=[...new Set(g.items.map(r=>r.pillar).filter(Boolean))];
    const weekKey=grain==='weekly'?A.sheetWeekKey(first):null;
    const p=grain==='summary'?{start:from,end:to}:grain==='weekly'?weeks.get(weekKey):A.period(first.day,grain);
    const start=p.start<from?from:p.start,end=p.end>to?to:p.end,inPeriod=r=>r.day>=start&&r.day<=end&&(grain!=='weekly'||A.sheetWeekKey(r)===weekKey);
    const peers=base.filter(r=>inPeriod(r)&&r.center===first.center&&A.sameMetricContext(r,first)&&r.format===first.format&&A.adIdentity(r)!==A.adIdentity(first));
    const denom=rows.filter(r=>inPeriod(r)&&temporalFilter(r)&&r.brand===first.brand&&r.account===first.account&&r.campaign===first.campaign&&r.adset===first.adset).reduce((s,r)=>s+r.spend,0);
    const centerDenom=base.filter(r=>inPeriod(r)&&r.center===first.center&&A.sameMetricContext(r,first)).reduce((s,r)=>s+r.spend,0);
    const latest=[...g.items].sort((a,b)=>b.day.localeCompare(a.day))[0];
    const benchmark=A.aggregate(peers);
    return applyRules({...g,id:grain==='summary'?i:`period_${i}`,grain,start,end,weekKey,weekNum:grain==='weekly'?first.weekNum:null,weekYear:grain==='weekly'?p.weekYear:null,partial:start!==p.start||end!==p.end,center:first.center,brand:first.brand,account:first.account,importSource:first.importSource,campaign:first.campaign,adset:first.adset,ad:first.ad,adCode:first.adCode,resultType:first.resultType,objective:first.objective,role:first.role,format:first.format,message:messages.length===1?messages[0]:messages.length?'Beberapa key message':'',missing:g.items.some(r=>!r.message),pillar:pillars.length===1?pillars[0]:pillars.length?'Beberapa pillar':'',missingPillar:g.items.some(r=>!r.pillar),lastDelivery:latest.status,lastDay:latest.day,share:A.ratio(g.spend,denom,100),centerShare:A.ratio(g.spend,centerDenom,100),benchmark},peers);
  });
}
function navigate(next){view=VIEWS[next]?next:'overview';page=0;render();window.scrollTo({top:0,behavior:'smooth'});}
function empty(title,desc){return `<div class="empty"><span class="empty-symbol">◈</span><h2>${esc(title)}</h2><p>${esc(desc)}</p></div>`;}
function render(){
  if(view!=='overview'&&$('overviewMapSlot'))$('overviewMapSlot').innerHTML='';
  updateDateRangeControl();workScopeControl();
  const [name,title,subtitle]=VIEWS[view];$('breadcrumb').textContent=name;$('pageTitle').textContent=name;$('pageSubtitle').textContent=subtitle;
  document.querySelectorAll('nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('myScope').classList.toggle('selected',scope==='MY');$('allScope').classList.toggle('selected',scope==='ALL');$('targetLabel').textContent=money(config.target);
  if(!loaded&&view==='meeting'){meetingTab='bucket';$('viewContent').innerHTML=renderMeeting();return;}
  if(!loaded){$('viewContent').innerHTML=lastError?empty('Unable to load data',lastError+' Klik Sinkronkan untuk mencoba lagi.'):empty('Connecting your data','Loading creative performance from Google Sheets.');return;}
  const invalid=$('startFilter').value&&$('endFilter').value&&$('startFilter').value>$('endFilter').value;
  $('endFilter').classList.toggle('filter-invalid',!!invalid);
  refreshData();$('rowCount').textContent=`${integer(selected.length)} baris · ${integer(creatives.length)} ad`;
  const alerts=creatives.filter(g=>needsReview(g)),missing=creatives.filter(g=>g.missing),total=A.aggregate(selected);
  $('navAlert').textContent=integer(alerts.length);
  let notices='';
  if(lastError)notices+=`<div class="notice error">⚠ Data terakhir ditampilkan. ${esc(lastError)}</div>`;
  if(invalid)notices+='<div class="notice error">Tanggal mulai harus sebelum atau sama dengan tanggal akhir.</div>';
  if(missing.length&&view!=='data')notices+=`<div class="notice">◌ <span><b>${integer(missing.length)} ad belum lengkap key message-nya.</b></span><button class="text-button" data-action="missing">Lihat daftar ↗</button></div>`;
  $('notices').innerHTML=notices;
  $('viewContent').innerHTML=({scorecards:renderScorecards,meeting:renderMeeting,overview:renderOverview,centers:renderCenters,messages:renderMessages,creatives:()=>renderExplorer(false),alerts:()=>renderExplorer(true),data:renderData}[view])();
  if(view==='overview')refreshCenterMap();
}
function section(title,sub='',action=''){return `<div class="section-heading"><div><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div>${action}</div>`;}
function metricDisplayData(s,key){
  const c=s.coverage?.[key],partial=!!c&&c.rows<c.totalRows;
  // A period ratio must use the same complete population as its visible totals.
  const count=key==='leads'||key==='booking';
  return {value:partial?(count?s.observed?.[key]??null:null):s.rows===0?null:s[key]??null,partial,coverage:c};
}
function metricCoverageText(c,key){if(!c?.rows)return 'Belum ada data laporan yang dapat dicocokkan. Nilai kosong bukan nol.';return `${c.rows}/${c.totalRows} baris · ${c.days} hari (${c.start} – ${c.end}). ${['leads','booking'].includes(key)?'Jumlah yang sudah tercatat; belum total akhir periode.':'Rasio periode belum dapat dihitung karena laporan belum lengkap.'} Baris tanpa laporan / ambigu tidak dianggap nol.`;}
function metricTargetMarkup(value,key,markup){if(key==='cpb'&&Number.isFinite(value))return `<span class="metric-target cpb-${CostTargets.cpbTier(value)}" title="${CostTargets.cpbLabel(value)} · safe ≤Rp300.000; warning ≤Rp400.000; review ≤Rp500.000; kill threshold >Rp500.000">${markup}</span>`;if(CostTargets.limit(key,config)&&Number.isFinite(value))return `<span class="metric-target ${CostTargets.meets(value,key,config)?'at-target':'below-target'}" title="${key.toUpperCase()} target: ${money(CostTargets.limit(key,config))}">${markup}</span>`;return key==='leadRate'&&Number.isFinite(value)?`<span class="metric-target ${value<80?'below-target':'at-target'}" title="Results &rarr; Leads target &ge;80%">${markup}</span>`:markup;}
function displayMetric(s,key,format){const d=metricDisplayData(s,key);const markup=d.partial?`<span data-report-partial="true" title="${esc(reportIssueLabel(s,key)+'. '+metricCoverageText(d.coverage,key))}">${format(d.value)}</span><small class="report-state">${['leads','booking'].includes(key)&&d.value!==null?'Recorded / '+reportIssueLabel(s,key):reportIssueLabel(s,key)}</small>`:format(d.value);return metricTargetMarkup(d.value,key,markup);}
function displaySnapshot(s){return {metrics:meetingMetrics(s),observed:s.observed,coverage:s.coverage};}
function kpiPerformance(s,key){
  const reading=overviewReading(s,key),target=key==='leadRate'?80:CostTargets.limit(key,config);
  if(!target||!Number.isFinite(reading.value))return 'neutral';
  if(key==='cpb')return CostTargets.cpbTier(reading.value);
  return (key==='leadRate'?reading.value>=target:reading.value<=target)?'good':'bad';
}
function kpis(){
  const t=summaryAggregate(selected),bad=t.cpr!==null&&t.cpr>config.target;
  const m=k=>summaryMetric(t,k,['leads','booking'].includes(k)?integer:k.startsWith('cp')?money:percent);
  const items=[['Total spend',money(t.spend),`${integer(creatives.length)} ad · ${integer(t.days.size)} hari dengan data`],['Results',integer(t.results),t.mixed?'Mixed result types · see CPR breakdown':esc([...t.types][0]||'Jenis Results belum tercatat')],['Leads',m('leads').html,m('leads').note||''],['CPR',t.mixed?resultTypeSummary(selected,'cpr'):money(t.cpr),t.mixed?'Calculated separately for each result type':t.cpr===null?'Belum ada Results':`${percent(Math.abs(t.cpr/config.target-1)*100)} ${bad?'di atas':'di bawah'} target`],['CPL',m('cpl').html,m('cpl').note||''],['Booking',m('booking').html,m('booking').note||''],['Cost per Booking',m('cpb').html,m('cpb').note||''],['Leads → Booking (%)',m('bookingRate').html,m('bookingRate').note||''],['Results → Leads (%)',t.mixed?resultTypeSummary(selected,'leadRate'):m('leadRate').html,t.mixed?'Calculated separately for each result type':m('leadRate').note||'']];
  return `<div class="kpis">${items.map(([label,value,sub],i)=>`<article class="kpi performance-${kpiPerformance(t,['spend','results','leads','cpr','cpl','booking','cpb','bookingRate','leadRate'][i])}" data-kpi="${['spend','results','leads','cpr','cpl','booking','cpb','bookingRate','leadRate'][i]}" data-open-scorecard="${['spend','results','leads','cpr','cpl','booking','cpb','bookingRate','leadRate'][i]}" tabindex="0" role="link" aria-label="${label}: open Metric Scorecards" title="Open Metric Scorecards"><div class="label">${label}<span>${['&#8599;','&#9673;','&#9831;','&#9678;','&#8600;','&#9636;','&#8600;','%','%'][i]}</span></div><div class="value">${value}</div><small>${sub}</small></article>`).join('')}</div>${summaryCoveragePanel(t)}`;
}
function renderOverview(){
  priorityData=buildPriorities();
  if(!selected.length)return kpis()+empty('No data for this selection','Ubah center, brand, periode, atau filter lainnya. Center tanpa data tetap terlihat di Center Insights.');
  const alerts=priorityData.ads,wins=candidates(),missingSpend=selected.filter(r=>!r.message).reduce((s,r)=>s+r.spend,0),total=A.aggregate(selected);
  const mappedShare=total.spend?100-missingSpend/total.spend*100:0;
  return kpis()+reportAuditPanel()+section('<span class="section-index">01 /</span> Your priorities today','')+
  `<div class="priority-grid map-support-grid"><article class="priority iterate"><span class="tag">ITERATION OPPORTUNITIES</span><span class="priority-symbol">✳</span><h3>${integer(wins.length)} <small>creative candidates</small></h3><button class="text-button" data-action="winners">Eksplorasi kandidat →</button></article><article class="priority"><span class="tag">CREATIVE CONTEXT</span><span class="priority-symbol">◌</span><h3>${percent(mappedShare)} <small>spend with key messages</small></h3><button class="text-button" data-view="messages">Buka key message lab →</button></article></div>`+
  renderAdsetPerformance()+renderCenterCharts()+
  renderTrends()+`<section class="card"><div class="card-heading"><div><h2>Additional metrics</h2><p>Supporting signals for your main metrics</p></div></div><div class="card-body">${metricsTable(total)}</div></section>`;

}
function centersInScope(){const specific=$('centerFilter').value;return specific!=='ALL'?[specific]:[...new Set(selected.map(r=>r.center))].sort();}
const CENTER_CHARTS=[['results','Results',false,'#327c86'],['leads','Leads',false,'#7464a6'],['booking','Booking',false,'#b88635'],['cpr','CPR',true,'#4f846d'],['cpl','CPL',true,'#527eb5'],['cpb','CPB',true,'#b36e83'],['bookingRate','Leads → Booking (%)',false,'#8164ad'],['leadRate','Results → Leads (%)',false,'#438b80']];
function centerChartData(key){
  return centersInScope().flatMap(center=>{
    const items=selected.filter(r=>r.center===center),groups=overviewGroups(items,key);
    return groups.map(g=>{
      const s=summaryAggregate(g.items),reading=overviewReading(s,key);
      return {center,value:reading.value,note:reading.note,partial:reading.partial,label:reading.label,context:groups.length>1?contextLabel(g.items[0]):''};
    });
  }).sort((a,b)=>(b.value??-1)-(a.value??-1)||a.center.localeCompare(b.center));
}
function renderCenterCharts(){return `<div class="center-chart-grid">${CENTER_CHARTS.map(([key,label,cost,color])=>{
  const data=centerChartData(key),max=Math.max(1,CostTargets.limit(key,config)*1.25||0,...data.map(g=>g.value||0));
  return `<section class="card center-metric-chart" data-center-metric="${key}"><div class="card-heading"><div><h2>${label} by ${workView==='preheat'?'preheat audience':workView==='all'?'center / audience':'center'}</h2></div></div><div class="card-body">${data.map(g=>`<div class="center-bar-entry"><div class="bar-row"><button data-center="${esc(g.center)}">${esc(g.center)}</button><div class="bar-track"><div class="bar-fill" style="width:${(g.value||0)/max*100}%;background:${g.partial?'#94aaa1':CostTargets.limit(key,config)&&g.value>CostTargets.limit(key,config)||key==='leadRate'&&g.value!==null&&g.value<80?'#c66b61':color}"></div>${CostTargets.limit(key,config)?`<span class="bar-target" style="left:${CostTargets.limit(key,config)/max*100}%"></span>`:''}</div><span class="bar-value" title="${esc(g.note)}">${g.value===null?'&mdash;':['bookingRate','leadRate'].includes(key)?percent(g.value):cost?money(g.value):integer(g.value)}</span></div>${g.context?`<small class="chart-coverage">${esc(g.context)}</small>`:''}</div>`).join('')}${data.some(g=>g.partial)?`<details class="chart-data-coverage"><summary>Data coverage</summary>${data.filter(g=>g.partial).map(g=>`<p><b>${esc(g.center)}</b> · ${esc(g.note)}</p>`).join('')}</details>`:''}</div></section>`;
}).join('')}</div>`;}
function metricsTable(s){return `<table><tbody>${[['CTR',percent(s.ctr),'Link clicks ÷ impressions'],['Hook rate',percent(s.hook),'3-sec plays ÷ video impressions'],['Views rate',percent(s.view),'100% plays ÷ video views'],['Frequency ≈',decimal(s.frequency),'Rata-rata berbobot impressions']].map(([k,v,d])=>`<tr><td>${k}<small>${d}</small></td><td class="num"><b>${v}</b></td></tr>`).join('')}</tbody></table>`;}
function centerTable(){
  return `<section class="card"><div class="table-wrap"><table><thead><tr><th>Center</th><th class="num">Spend</th><th class="num">Results</th><th class="num">Leads</th><th class="num">CPR</th><th class="num">CPL</th><th class="num">Booking</th><th class="num">CPB</th><th class="num">Leads → Booking (%)</th><th class="num">Results → Leads</th><th class="num">Avg Results/hari*</th><th class="num">Avg Leads/hari*</th><th class="num">CTR</th><th class="num">Hook rate</th><th class="num">Views rate</th><th class="num">Frequency ≈</th></tr></thead><tbody>${centersInScope().map(c=>{
    const s=A.aggregate(selected.filter(r=>r.center===c));return `<tr><td class="cell-name"><button class="center-link" data-center="${esc(c)}"><span class="center-code">${esc(c)}</span>${esc(labels[c]||c)}</button>${!s.rows?`<small>${c==='BDS'?'Dalam pembangunan · belum beriklan':'Tidak ada data pada filter ini'}</small>`:''}</td>${[money(s.rows?s.spend:null),s.rows?integer(s.results):'—',displayMetric(s,'leads',integer),money(s.cpr),displayMetric(s,'cpl',money),displayMetric(s,'booking',integer),displayMetric(s,'cpb',money),displayMetric(s,'bookingRate',percent),displayMetric(s,'leadRate',percent),decimal(s.avgResults),decimal(s.avgLeads),percent(s.ctr),percent(s.hook),percent(s.view),decimal(s.frequency)].map(v=>`<td class="num">${v}</td>`).join('')}</tr>`;
  }).join('')}</tbody></table></div></section>`;
}
function messageGroups(){return A.group(selected.filter(r=>r.message),r=>JSON.stringify([r.center,A.metricContext(r),r.message])).map(g=>({...g,center:g.items[0].center,message:g.items[0].message,brand:g.items[0].brand,objective:A.analysisObjective(g.items[0]),resultType:g.items[0].resultType,state:creatives.some(c=>['ITERATE','OPPORTUNITY'].includes(c.state)&&c.center===g.items[0].center&&A.sameMetricContext(c,g.items[0])&&c.message===g.items[0].message)?'ITERATE':A.state(g,config)}));}
function bestMessage(center){return messageGroups().filter(g=>g.center===center&&g.state==='ITERATE').sort((a,b)=>a.cpr-b.cpr||b.leads-a.leads)[0];}
function renderCenters(){
  const cards=centersInScope().map(c=>{
    const items=selected.filter(r=>r.center===c),s=summaryAggregate(items),best=bestMessage(c),alert=creatives.filter(g=>g.center===c&&needsReview(g)).length,tag=A.state(s,config);
    return `<article class="center-card"><div class="row"><div><h3>${esc(c)}</h3><small>${esc(labels[c]||'Center')}</small></div>${pill(tag)}</div>${centerSummaryMetricStrip(s)}${centerSummaryCoverage(s)}<p>${c==='BDS'&&!s.rows?'Dalam pembangunan. Belum diiklankan; tidak dinilai sebagai underperform.':!s.rows?'Belum ada data pada filter ini.':best?`Pesan potensial: <b>${esc(best.message)}</b> · ${money(best.cpr)} CPR · ${integer(best.results)} Results.`:items.some(r=>r.message)?'Belum ada key message yang memenuhi target dan ambang sampel.':'Key message belum diisi. Lengkapi Creative Mapping sebelum menentukan pesan yang cocok.'}</p><div class="row"><button class="text-button" data-center="${esc(c)}">Eksplorasi center →</button><small>${alert?`${alert} ad perlu review`:s.rows?'Tidak ada alert CPR':'Belum dinilai'}</small></div></article>`;
  }).join('');
  return renderContentRankings()+`<div class="center-grid center-insight-cards">${cards}</div>`;
}
function renderMessages(){
  const groups=messageGroups(),total=A.aggregate(selected),mapped=selected.filter(r=>r.message),coverage=A.ratio(mapped.reduce((s,r)=>s+r.spend,0),total.spend,100);
  let html=`<section class="card"><div class="card-heading"><div><h2>Key message coverage</h2></div><span class="pill">${percent(coverage)} dari spend</span></div><div class="card-body"><div class="progress"><div style="width:${coverage||0}%"></div></div><small>${integer(mapped.length)} dari ${integer(selected.length)} baris sudah diisi.</small></div></section>`;
  if(!groups.length)return html+empty('Add your key messages','Belum ada key message untuk filter ini. Isi kolom “Key Message Content” di tab Creative Mapping pada ad yang relevan, lalu klik Sinkronkan. Matrix center dan rekomendasi pesan akan terisi dari data tersebut.')+'<div style="text-align:center"><button class="button secondary" data-action="missing">Lihat ad yang perlu dilengkapi →</button></div>';
  const centers=centersInScope(),messages=[...new Set(groups.sort((a,b)=>b.spend-a.spend).map(g=>g.message))];
  html+=section('Center × key message','',`<select id="matrixMetric" aria-label="Metrik matrix"><option value="cpr" ${matrixMetric==='cpr'?'selected':''}>CPR</option><option value="bookingRate" ${matrixMetric==='bookingRate'?'selected':''}>Leads → Booking (%)</option><option value="leadRate" ${matrixMetric==='leadRate'?'selected':''}>Results → Leads</option><option value="ctr" ${matrixMetric==='ctr'?'selected':''}>CTR</option></select>`);
  html+=`<section class="card"><div class="table-wrap"><table class="matrix"><thead><tr><th>Key message</th>${centers.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${messages.map(msg=>`<tr><td class="cell-name"><b>${esc(msg)}</b></td>${centers.map(c=>{const items=selected.filter(r=>r.center===c&&r.message===msg),s={...A.aggregate(items),items},st=A.state(s,config);return `<td>${items.length?`<button class="heat ${st} text-button" data-message="${esc(msg)}" data-message-center="${esc(c)}">${displayMetric(s,matrixMetric,matrixMetric==='cpr'?money:percent)}<small>${integer(s.results)} Results</small></button>`:'<span class="heat">—</span>'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  html+=section('Messages worth testing again','');
  const winners=groups.filter(g=>g.state==='ITERATE').sort((a,b)=>a.cpr-b.cpr);
  html+=winners.length?`<div class="center-grid">${winners.map(g=>`<article class="center-card"><div class="row"><span class="pill ITERATE">${esc(g.center)}</span><b>${money(g.cpr)}</b></div><h3 style="margin:16px 0;font-size:15px">${esc(g.message)}</h3><p>${integer(g.results)} Results · ${integer(g.leads)} Leads · CPL ${money(g.cpl)}<br>${esc(g.objective)} · ${esc(g.resultType)}<br>Uji satu hook/visual baru dengan pesan ini. Pantau CPR dan kualitas Leads.</p><button class="text-button" data-message="${esc(g.message)}" data-message-center="${esc(g.center)}">Lihat creative pendukung →</button></article>`).join('')}</div>`:empty('No messages meet the criteria yet','Jangan menetapkan winner sebelum target dan minimum sampel terpenuhi.');
  html+=section('Key message performance by center','');
  html+=`<section class="card"><div class="table-wrap"><table><thead><tr>${['Center / objective','Key message','Spend','Results','Leads','CPR','CPL','Booking','CPB','Leads → Booking (%)','Results → Leads','CTR','Hook','Views rate','Frequency ≈','Status'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${groups.map(g=>`<tr><td class="cell-name">${esc(g.center)}<small>${esc(g.objective)} · ${esc(g.resultType)}</small></td><td class="cell-name"><button class="ad-link" data-message="${esc(g.message)}" data-message-center="${esc(g.center)}">${esc(g.message)}</button></td>${[money(g.spend),integer(g.results),displayMetric(g,'leads',integer),money(g.cpr),displayMetric(g,'cpl',money),displayMetric(g,'booking',integer),displayMetric(g,'cpb',money),displayMetric(g,'bookingRate',percent),displayMetric(g,'leadRate',percent),percent(g.ctr),percent(g.hook),percent(g.view),decimal(g.frequency)].map(v=>`<td class="num">${v}</td>`).join('')}<td>${actionStatus(g)}</td></tr>`).join('')}</tbody></table></div></section>`;
  return html;
}
function explorerList(isAlert){
  let list=(isAlert||explorerGrain==='summary'?creatives:periodCreatives).filter(g=>!isAlert||(alertMode==='missing'?g.missing:alertMode==='validation'?g.state==='MIXED':needsReview(g)));
  if(!isAlert&&explorerGrain==='weekly'&&explorerWeek!=='ALL')list=list.filter(g=>g.weekKey===explorerWeek);
  if(tableState!=='ALL')list=list.filter(g=>(tableState==='EVALUATE'?g.creativeEvaluation:g.state===tableState));
  if(delivery!=='ALL')list=list.filter(g=>g.lastDelivery===delivery);
  list.sort((a,b)=>tableSort==='period'?b.start.localeCompare(a.start)||b.spend-a.spend:tableSort==='cpr'?(b.cpr??(b.results?0:Infinity))-(a.cpr??(a.results?0:Infinity)):tableSort==='share'?(b.share||0)-(a.share||0):b[tableSort]-a[tableSort]);
  return list;
}
function weeklySelector(){
  const weeks=[...new Map(periodCreatives.map(g=>[g.weekKey,g])).values()].sort((a,b)=>a.weekYear.localeCompare(b.weekYear)||(a.weekNum??99)-(b.weekNum??99));
  const missing=selected.filter(r=>r.weekNum===null).length;
  return `<section class="card weekly-selector"><div class="card-heading"><div><h2>Select a week</h2></div><span class="pill">${weeks.length} kelompok minggu</span></div><div class="week-options"><button class="button ${explorerWeek==='ALL'?'primary':'secondary'}" data-week="ALL" aria-pressed="${explorerWeek==='ALL'}">Semua minggu</button>${weeks.map(w=>`<button class="button ${explorerWeek===w.weekKey?'primary':'secondary'}" data-week="${esc(w.weekKey)}" aria-pressed="${explorerWeek===w.weekKey}">${esc(shortWeek(w))}</button>`).join('')}</div>${missing?`<p class="mini-note red-text">${integer(missing)} baris memiliki Week Num kosong / tidak valid. Ditampilkan dalam kelompok tersendiri; nomor minggu tidak ditebak dari tanggal.</p>`:''}</section>`;
}
function renderExplorer(isAlert){
  const list=explorerList(isAlert),limit=40,pages=Math.max(1,Math.ceil(list.length/limit));page=Math.min(page,pages-1);
  let html=isAlert?'':`<div class="toolbar time-toolbar"><div><h2>Creative performance</h2><small>Your selected date range applies.</small></div>${grainControl('explorer',explorerGrain,true)}</div>`;
  if(!isAlert&&['daily','weekly'].includes(explorerGrain))html+=`<div class="scope-switch layout-switch"><button data-layout="compare" class="${explorerLayout==='compare'?'selected':''}">Perbandingan</button><button data-layout="rows" class="${explorerLayout==='rows'?'selected':''}">Tabel periode</button></div>`;
  if(!isAlert&&explorerGrain==='weekly')html+=weeklySelector();
  if(isAlert){
    const perf=creatives.filter(g=>needsReview(g)),missing=creatives.filter(g=>g.missing),validation=creatives.filter(g=>g.state==='MIXED');
    html=`<div class="toolbar"><div class="scope-switch"><button class="${alertMode==='performance'?'selected':''}" data-alert="performance">Performa (${integer(perf.length)})</button><button class="${alertMode==='missing'?'selected':''}" data-alert="missing">Key message kosong (${integer(missing.length)})</button><button class="${alertMode==='validation'?'selected':''}" data-alert="validation">Validasi (${integer(validation.length)})</button></div></div>`;
    html+=`<div class="notice ${alertMode==='missing'?'':'info'}">${alertMode==='missing'?'◌ Isi “Key Message Content” di Raw Data untuk setiap baris ad yang relevan. Alert akan hilang setelah seluruh baris pada periode terpilih sudah berlabel dan tersinkron.':alertMode==='validation'?'ⓘ Jenis Results belum tercatat. Lengkapi data sebelum mengambil keputusan CPR.':'⚑ Rekomendasi kill reguler menunggu spend ≥ '+money(config.minSpend)+'. Semua aturan kill memakai minimum spend ini, tanpa pengecualian. Additional metrics hanya untuk evaluasi creative. Semua keputusan berupa rekomendasi manual; status delivery terakhir tetap ditampilkan.'}</div>`;
  }
  html+=`<div class="toolbar"><small><b>${!isAlert&&explorerLayout==='compare'&&['daily','weekly'].includes(explorerGrain)?'Perbandingan antarperiode':integer(list.length)+(explorerGrain!=='summary'&&!isAlert?' baris ad × periode':' ad')}</b> · campaign + ad set + ad name + jenis Results</small><div><select id="tableState" aria-label="Filter status performa"><option value="ALL">Semua status performa</option>${Object.entries(STATE).filter(([k])=>k!=='WATCH').map(([k,v])=>`<option value="${k}" ${tableState===k?'selected':''}>${v}</option>`).join('')}</select><select id="deliveryFilter" aria-label="Status delivery terakhir"><option value="ALL">Semua delivery</option><option value="active" ${delivery==='active'?'selected':''}>Terakhir aktif</option><option value="inactive" ${delivery==='inactive'?'selected':''}>Terakhir nonaktif</option></select><select id="tableSort" aria-label="Urutkan creative">${[...(!isAlert&&explorerGrain!=='summary'?[['period','Periode terbaru']]:[]),['spend','Spend terbesar'],['cpr','CPR tertinggi'],['results','Results terbanyak'],['leads','Leads terbanyak'],['share','Spend share tertinggi']].map(([k,v])=>`<option value="${k}" ${tableSort===k?'selected':''}>${v}</option>`).join('')}</select></div></div>`;
  if(!isAlert&&['daily','weekly'].includes(explorerGrain)&&explorerLayout==='compare')return html+renderComparison();
  if(!list.length)return html+empty(isAlert?'No alerts for these filters':'No creatives for these filters','Ubah periode atau filter jika ingin melihat data lainnya. Tidak ada data bukan berarti seluruh creative sudah perform.');
  html+=`<section class="card"><div class="table-wrap"><table><thead><tr>${!isAlert&&explorerGrain!=='summary'?'<th>Periode</th>':''}<th>Status</th><th>Center / brand</th><th>Ad name & key message</th><th>Umur ad</th><th class="num">Spend</th><th class="num">Spend share<br>di ad set</th><th class="num">Results</th><th class="num">Leads</th><th class="num">Results → Leads</th><th class="num">CPR</th><th class="num">CPL</th><th class="num">Booking</th><th class="num">CPB</th><th class="num">Leads → Booking (%)</th><th class="num">CTR</th><th class="num">Hook rate</th><th class="num">Views rate</th><th class="num">Frequency ≈</th><th>Langkah berikutnya</th></tr></thead><tbody>${list.slice(page*limit,(page+1)*limit).map(g=>`<tr>${!isAlert&&explorerGrain!=='summary'?`<td class="period-cell">${g.grain==='weekly'?esc(shortWeek(g)):`${esc(periodText(g))}<small>${GRAINS[g.grain]}${g.partial?' · parsial':''} · ${g.days.size} hari dengan data</small>`}</td>`:''}<td>${actionStatus(g)}<small>${esc(g.lastDelivery||'Tidak diketahui')} · ${esc(g.lastDay)}</small></td><td><b>${esc(g.center)}</b><small>${g.brand==='SLSA'?'SLSA':'English'} · ${esc(g.role)}</small></td><td class="cell-name"><button class="ad-link" data-detail="${g.id}">${esc(g.ad)}</button><small title="${esc(g.adset)}">${esc(g.adset)}</small>${accountBadge(g.account)}<small class="${g.missing?'red-text':''}">${esc(g.message||'⚑ Key message belum diisi')}${g.message&&g.missing?' · sebagian baris kosong':''}</small></td><td class="num">${ageCell(g)}<small>sejak publish</small><small>${g.history?.activeDays??0} hari tercatat aktif</small></td>${[money(g.spend),percent(g.share),integer(g.results),displayMetric(g,'leads',integer),displayMetric(g,'leadRate',percent),money(g.cpr),displayMetric(g,'cpl',money),displayMetric(g,'booking',integer),displayMetric(g,'cpb',money),displayMetric(g,'bookingRate',percent),percent(g.ctr),percent(g.hook),percent(g.view),decimal(g.frequency)].map((v,i)=>`<td class="num ${i===5&&g.cpr>config.target?'negative':''}">${v}</td>`).join('')}<td class="cell-name"><small>${esc(isAlert&&alertMode==='missing'?'Isi key message di Creative Mapping, lalu sinkronkan.':g.diagnosis.actions[0])}</small><button class="text-button" data-detail="${g.id}">Analisis →</button></td></tr>`).join('')}</tbody></table></div><div class="pager"><span>${integer(page*limit+1)}–${integer(Math.min((page+1)*limit,list.length))} dari ${integer(list.length)}</span><button class="button secondary" data-page="prev" ${page===0?'disabled':''}>←</button><span>${page+1} / ${pages}</span><button class="button secondary" data-page="next" ${page===pages-1?'disabled':''}>→</button></div></section>`;
  return html;
}
function showDetail(id){
  const g=findCreative(id);if(!g)return;
  detailPeriodAd=g;detailPeriodGrain='daily';detailPeriodMode='totals';
  const b=g.benchmark,compare=[['CPR',g.cpr,b.cpr,money],['CPL',g.cpl,b.cpl,money],['CPB',g.cpb,b.cpb,money],['Leads → Booking (%)',g.bookingRate,b.bookingRate,percent],['Results → Leads',g.leadRate,b.leadRate,percent],['CTR',g.ctr,b.ctr,percent],['Hook rate',g.hook,b.hook,percent],['Views rate',g.view,b.view,percent],['Frequency ≈',g.frequency,b.frequency,decimal]];
  $('detailContent').innerHTML=`<h2 class="detail-title">${esc(g.ad)}</h2>${A.identitySuffix(g).length?`<p>${esc(A.identitySuffix(g)[0])}</p>`:""}<div class="detail-meta"><b>${GRAINS[g.grain]} · ${esc(periodText(g))}${g.partial?' · parsial':''}</b><br>${esc(g.center)} · ${g.brand==='SLSA'?'Sparks Leadership Speech Academy':'Sparks English'} · ${esc(g.objective)} · ${esc(g.resultType)}<br>${accountBadge(g.account)}<br>${esc(g.campaign)}<br>${esc(g.adset)}<br>Key message: <b>${esc(g.message||'Belum diisi')}</b>${g.missing?' · ⚑ ada baris yang belum diisi':''}<br>Content pillar: <b>${esc(g.pillar||'Belum diisi')}</b><br>Format: ${esc(g.format)} (berdasarkan awalan kode V / I) · delivery terakhir: ${esc(g.lastDelivery)} (${prettyDate(g.lastDay)})</div>${actionStatus(g)}${metricScopeComparison(g)}${historyPanel(g)}<div class="diagnosis"><h3>What the metrics show</h3><ul>${g.diagnosis.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><h3 style="margin-top:20px">Hypotheses & next experiments</h3><ul>${g.diagnosis.actions.map(r=>`<li>${esc(r)}</li>`).join('')}${g.missing?'<li>Lengkapi key message sebelum menetapkan pesan mana yang perlu diulang atau diubah.</li>':''}</ul><small>Diagnosis ini berbasis pola metrik. Tinjau materi creative dan konteks audience/sales untuk memeriksa penyebab.</small></div><h3>Center peer benchmarks ${esc(g.center)}</h3>${assessmentPanel(g)}<p class="mini-note">${integer(b.rows)} baris peer · brand, objective, jenis Results, format, peran campaign (jika difilter), dan periode yang sama. Ad ini dikeluarkan. Filter pencarian/key message tidak mempersempit benchmark.</p><table class="comparison"><thead><tr><th>Metrik</th><th class="num">Ad ini</th><th class="num">Peer center</th><th class="num">Selisih relatif</th></tr></thead><tbody>${compare.map(([k,v,bv,f])=>`<tr><td>${k}</td><td class="num">${k==='Results \u2192 Leads'?metricTargetMarkup(v,'leadRate',f(v)):f(v)}</td><td class="num">${k==='Results \u2192 Leads'?metricTargetMarkup(bv,'leadRate',f(bv)):f(bv)}</td><td class="num">${v!==null&&bv>0?`${v>=bv?'+':''}${percent((v/bv-1)*100)}`:'—'}</td></tr>`).join('')}</tbody></table><details class="ad-source-rows"><summary>Source rows</summary><p class="mini-note">Spend Share asli ditampilkan seperti di sheet; tidak dijumlahkan lintas hari. Nilai kosong ditampilkan sebagai —.</p><div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Key message</th><th class="num">Spend</th><th class="num">Results</th><th class="num">Leads</th><th class="num">Spend Share asli</th></tr></thead><tbody>${[...g.items].sort((a,b)=>a.day.localeCompare(b.day)).map(r=>`<tr><td>${esc(r.day)}</td><td>${esc(r.message||'Belum diisi')}</td><td class="num">${money(r.spend)}</td><td class="num">${integer(r.results)}</td><td class="num">${integer(r.leads)}</td><td class="num">${r.raw['Spend Share']===null?'—':esc(r.raw._format?.['Spend Share'] || (typeof r.raw['Spend Share']==='number'?percent(r.raw['Spend Share']*100):r.raw['Spend Share']))}</td></tr>`).join('')}</tbody></table></div></details><div class="detail-actions"><button class="button secondary" data-meeting-ad="${g.id}">Tambah ke meeting</button><button class="button primary" data-copy="${g.id}">Salin brief eksperimen</button><a class="button secondary" target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/${SHEET}/edit#gid=1162805758">Buka Raw Data ↗</a></div>`;
  $('detailDialog').showModal();
}
function renderData(){
  const t=A.aggregate(selected),missing=creatives.filter(g=>g.missing),invalidDate=rows.filter(r=>!r.day).length,unknown=selected.filter(r=>r.resultType==='Tidak tercatat').length,leadMissing=selected.filter(r=>r.leads===null).length,rateAnomaly=creatives.filter(g=>g.leadRate>100).length,days=[...new Set(rows.map(r=>r.day).filter(Boolean))].sort();
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}),age=days.length?Math.floor((Date.parse(today)-Date.parse(days.at(-1)))/86400000):null;
  return `${renderDataFlow()}<div class="data-health">${[['Baris di filter',integer(selected.length),'Dari '+integer(rows.length)+' baris sumber'],['Ad tanpa key message',integer(missing.length),'Alert terpisah dari performa'],['Jenis Results kosong',integer(unknown),'Perlu konteks sebelum menilai CPR'],['Update terakhir data',days.length?prettyDate(days.at(-1)):'—',age===null?'Belum ada tanggal':age+' hari sebelum hari ini']].map(([k,v,d])=>`<div class="health-card"><small>${k}</small><b style="${k.includes('Update')?'font-size:19px':''}">${v}</b><small>${d}</small></div>`).join('')}</div>${knowledgeError?`<div class="notice">${esc(knowledgeError)}</div>`:''}${costTargetsMethodology()}${rulesMethodology()}${adsetMethodology()}${metricIntegrityMethodology()}${iterationMethodology()}<div class="method-grid"><section class="card method"><h3>Sources & synchronization</h3><ul><li><strong>Raw Data</strong>: sumber data iklan utama, termasuk seluruh account. <strong>Report Totals</strong> mendukung pencocokan Leads/Booking dan summary ad set yang memenuhi aturan atribusi. Import tabs tidak dibaca oleh dashboard dan tidak diperbarui oleh upload CSV.</li><li><strong>Knowledge</strong>: istilah bisnis dan nama center. ${integer(knowledge.length)} baris pengetahuan terbaca pada sinkronisasi terakhir.</li><li>Polling otomatis setiap <strong>10 menit</strong> saat halaman terbuka, serta tombol Sinkronkan. Waktu refresh bukan tanggal terbaru data.</li><li>Data terakhir tetap ditampilkan ketika sync gagal, dengan status error yang terlihat. Angka tidak diganti dengan nol.</li><li>Pengaturan ambang disimpan di browser ini. Data performa tidak disimpan ke layanan tambahan.</li><li>Dashboard memakai jalur baca Google Sheets yang sama seperti dashboard lama. Akses sheet harus mengizinkan pembacaan dari browser.</li></ul><p class="mini-note">Sinkronisasi berhasil terakhir: ${lastSync?lastSync.toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'—'}.</p></section><section class="card method"><h3>Center & brand scope</h3><ul><li><strong>My assignments:</strong> Third account hanya ad set ${MY_THIRD_ADSETS.map(esc).join(', ')}. Centers memisahkan ad set center dari Preheat (C.IN); All work menggabungkan keduanya. All assignments menampilkan juga pekerjaan anggota tim lain.</li><li>Center saya: <strong>${A.MINE.join(', ')}</strong>. Diambil dari kode center pada Ad set name.</li><li><strong>BDS berbeda dari BSD.</strong> BDS masih dalam pembangunan dan tidak dianggap underperform saat belum ada data.</li><li>Token <strong>SLSA</strong> pada campaign atau ad set menandai Sparks Leadership Speech Academy. Data lain merupakan Sparks English sesuai konvensi yang Anda berikan.</li><li>Gunakan filter brand untuk menilai secara terpisah. Rekomendasi creative tidak menggabungkan brand.</li><li><strong>Third account:</strong> kode _TA pada Daily Report menandai Third jika Account Group kosong. CL.JU_T_D_W_TA dipadankan dengan ALLS-ENG-JU_T_D_W_TA berdasarkan tanggal dan kode creative; laporan antar-account tetap terpisah.</li><li>Kode T/L/S = Traffic/Leads/Sales; M/E/D = Main/Experiment/Diversified. CL.JU adalah cluster, bukan satu cabang.</li><li>Jika format penamaan berubah, periksa kategori “Tidak diketahui” sebelum mengambil keputusan.</li></ul></section><section class="card method"><h3>Main metrics</h3><ul><li><strong>WhatsApp:</strong> Traffic dan Leads dengan Results messaging digabung berdasarkan kebutuhan bisnis. Objective asli tetap tersedia untuk filter dan export. Spend pada baris Traffic/Leads tanpa Result type dan nol Results masuk perhitungan WhatsApp; tipe mentah tetap tidak diubah untuk validasi ad. Sales, Booking, klik, brand, dan jenis hasil lainnya tetap dipisah.</li><li><strong>Partial reports:</strong> Leads dan Booking yang sudah tercatat tetap ditampilkan meskipun baris lain belum lengkap. CPL memakai spend dari baris dengan Leads; CPB memakai spend dari baris dengan Booking. Results to Leads memakai Results pada baris yang memiliki Leads. Arahkan kursor ke angka untuk melihat cakupan baris, tanggal, dan spend. Baris tanpa laporan tidak dianggap nol. Perbandingan warna dan rekomendasi tidak memakai angka Partial sebagai data lengkap.</li><li><strong>Leads → Booking (%)</strong> = total Booking / total Leads x 100%. Leads harus lebih dari nol. Untuk data Partial, hanya baris dengan Leads dan Booking yang sama-sama tersedia yang dihitung; rekomendasi tetap memerlukan data lengkap. Nilai di atas 100% tidak dipotong: periksa perbedaan tanggal/atribusi Leads dan Booking. Ini rasio periode, bukan pelacakan cohort orang yang sama; bukan aturan kill otomatis.</li><li><strong>CPR = Σ spend ÷ Σ Results</strong>; CPL = Σ spend ÷ Σ Leads; CPB = Σ spend ÷ Σ Booking. Nol denominator → —, bukan Rp0.</li><li><strong>Results → Leads = Σ Leads ÷ Σ Results × 100%</strong>. Target &ge;80%; di bawah 80% berwarna merah, &ge;80% hijau. Data kosong tetap netral. Target ini tidak menambah rekomendasi kill otomatis. Results mengikuti Result type; traffic click tidak otomatis chat. Leads adalah orang yang sudah mengirim pesan menurut Knowledge.</li><li><strong>Spend share = spend ad yang tampil ÷ seluruh spend ad set dalam periode × 100%</strong>. Angka asli per baris tersedia di detail ad. Persentase harian tidak dijumlahkan.</li><li>Rata-rata Results/Leads harian = total ÷ jumlah tanggal yang memiliki data pada filter. Bukan rata-rata per ad.</li><li>CPR gabungan disembunyikan saat objective / jenis Results berbeda. Gunakan filter untuk membandingkan hasil yang setara.</li></ul></section><section class="card method"><h3>Additional metrics & interpretation</h3><ul><li><strong>CTR = Σ Link clicks ÷ Σ Impressions × 100%</strong>.</li><li><strong>Hook rate = Σ 3-second plays ÷ Σ Impressions video × 100%</strong>.</li><li><strong>Views rate = Σ 100% plays ÷ Σ Views video × 100%</strong>, mengikuti denominator yang terlihat pada Raw Data.</li><li>Format video diidentifikasi dari kode creative berawalan V, image dari I. Format lain tidak diberi diagnosis hook atau retention.</li><li><strong>Frequency ≈ Σ(frequency baris × impressions) ÷ Σ impressions</strong>. Ini estimasi rata-rata, bukan frequency deduplikasi periode karena Reach tidak tersedia.</li><li>Rate ≥100% tidak dipotong; perbedaan atribusi/tanggal perlu ditinjau. ${integer(rateAnomaly)} ad memiliki Results → Leads &gt;100%.</li></ul></section><section class="card method"><h3>Action evaluation scope</h3><p>Status tindakan mengikuti Main-metric action rules di atas. Meeting dan kandidat iterasi memakai angka evaluasi 7 hari; tabel historis tetap memakai rentang tanggal pilihan. Additional metrics hanya menjadi label pendamping Evaluasi creative.</p><button class="text-button" data-action="settings">Edit thresholds</button></section><section class="card method"><h3>Data quality & completeness</h3><ul><li><strong>${integer(missing.length)}</strong> ad memiliki baris tanpa key message. Isi key message dan pillar di tab Creative Mapping, lalu sinkronkan.</li><li><strong>${integer(leadMissing)}</strong> baris tanpa Leads. Nilai kosong tidak diperlakukan sebagai bukti nol leads; cakupan ditampilkan pada KPI.</li><li><strong>${integer(invalidDate)}</strong> baris sumber tanpa tanggal valid dikeluarkan dari analisis periode.</li><li>Result type kosong pada hari nol Results hanya diwarisi jika ad yang sama pada campaign dan ad set yang sama memiliki tepat satu jenis Results diketahui.</li><li>Account ID dan Ad ID pada export digunakan importer dan pencocokan laporan di sheet bila tersedia. Grouping creative dashboard tetap memakai account, campaign, ad set, ad name dan jenis Results; nama identik dalam konteks yang sama perlu diperiksa.</li><li>Key message tidak ditebak dari kode iklan. Rekomendasi hanya menggunakan label Raw Data yang tersedia.</li></ul><button class="text-button" data-action="missing">Lihat data yang perlu dilengkapi →</button></section></div>`;
}
function brief(g){return [`BRIEF EKSPERIMEN — ${g.adCode}`,`Center: ${g.center} | Brand: ${g.brand} | ${g.objective} | ${g.resultType}`,`Periode: ${g.start} s.d. ${g.end} (${GRAINS[g.grain]})${g.grain==='weekly'?' | '+weekLabel(g):''}`,`Ad: ${g.ad}`,`Ad set: ${g.adset}`,`Key message: ${g.message||'Belum diisi — perlu dilengkapi'}`,`Spend ${money(g.spend)} | Results ${integer(g.results)} | Leads ${integer(g.leads)} | CPR ${money(g.cpr)} | CPL ${money(g.cpl)} | Spend share ${percent(g.share)}`,`Status: ${STATE[g.state]}`,`Umur sejak publish: ${ageCell(g)} | Hari tercatat aktif: ${g.history?.activeDays??0}`,'Observasi:',...g.diagnosis.reasons.map(x=>'- '+x),'Hipotesis / tindakan:',...g.diagnosis.actions.map(x=>'- '+x),'Uji satu perubahan pada center, objective, jenis Results dan periode yang sebanding. Evaluasi CPR dan kualitas Leads setelah minimum sampel tercapai.'].join('\n');}
function csvCell(v){let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function exportCsv(){
  if(!loaded)return notify('Tunggu data selesai dimuat.');
  const list=view==='creatives'&&['daily','weekly'].includes(explorerGrain)&&explorerLayout==='compare'?comparisonExportRows():view==='alerts'||view==='creatives'?explorerList(view==='alerts'):creatives;
  const header=['Center','Brand','Campaign','Ad set','Ad name','Ad code','Key message','Missing key message','Objective','Result type','Status','Latest delivery','Spend','Spend share ad set %','Results','Leads','Results to Leads %','CPR','CPL','Booking','CPB','CTR %','Hook %','Views rate %','Frequency estimate','Recommendation','View','Period start','Period end','Partial period','Week Num','Week year','Filter start','Filter end','Comparison window','Publish date','Age since publish days','Observed active days','Age as of','Low share consecutive days','Kill reasons','Leads to Booking %','Account','Import Source','Action rules version','Evaluation start','Evaluation end','Evaluation spend','Evaluation Results','Evaluation Leads','Evaluation Booking','Evaluation CPR','Evaluation CPL','Evaluation CPB','Evaluation Results to Leads %','Evaluation share %','Creative evaluation','Leads reported rows','Booking reported rows','Period source rows'];
  const records=list.map(g=>[g.center,g.brand,g.campaign,g.adset,g.ad,g.adCode,g.message,g.missing,g.objective,g.resultType,STATE[g.state],g.lastDelivery,g.spend,g.share,g.results,g.leadRows?g.leads:null,g.leadRate,g.cpr,g.cpl,g.bookingRows?g.booking:null,g.cpb,g.ctr,g.hook,g.view,g.frequency,g.diagnosis.actions.join(' | '),GRAINS[g.grain],g.start,g.end,g.partial,g.weekNum,g.weekYear,$('startFilter').value,$('endFilter').value,g.comparisonLabel||'',g.history?.published,g.history?.ageDays,g.history?.activeDays,g.history?.asOf,g.history?.lowShareDays,(g.killReasons||[]).join(' | '),g.bookingRate,g.account||'Unknown',g.importSource||'',g.actionEvidence?.version,g.actionEvidence?.start,g.actionEvidence?.end,g.operational?.spend,g.operational?.results,g.operational?.leadRows===g.operational?.rows?g.operational?.leads:null,g.operational?.bookingRows===g.operational?.rows?g.operational?.booking:null,g.operational?.cpr,g.operational?.cpl,g.operational?.cpb,g.operational?.leadRate,g.operational?.share,!!g.creativeEvaluation,g.leadRows,g.bookingRows,g.rows]);
  const text='\ufeff'+[header,...records].map(r=>r.map(csvCell).join(',')).join('\r\n'),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download=`sparks-${view}-${$('startFilter').value||'all'}-${$('endFilter').value||'all'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify(`${list.length} baris diekspor sesuai filter dan tampilan waktu.`);
}
function settings(){ $('targetInput').value=config.target;$('cplTargetInput').value=CostTargets.limit('cpl',config);$('cpbTargetInput').value=CostTargets.limit('cpb',config);$('spendInput').value=config.minSpend;$('resultsInput').value=config.minResults;$('settingsDialog').showModal(); }
function reset(){explorerWeek='ALL';rollingPeriod=true;datePreset='last7';scope='MY';workView='centers';for(const id of ['centerFilter','resultFilter','roleFilter','messageFilter','accountFilter','campaignFilter'])$(id).value='ALL';$('objectiveFilter').value='WHATSAPP';$('brandFilter').value='English';$('searchFilter').value='';const ds=rows.map(r=>r.day).filter(Boolean).sort();if(ds.length){$('endFilter').value=ds.at(-1);const d=new Date(ds.at(-1)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-6);$('startFilter').value=d.toISOString().slice(0,10);}tableState='ALL';delivery='ALL';tableSort='spend';page=0;updateOptions();render();}
document.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.adsetToggle!==undefined){const key=b.dataset.adsetToggle;expandedAdsets.has(key)?expandedAdsets.delete(key):expandedAdsets.add(key);const table=b.closest('.adset-performance');if(table){const holder=document.createElement('div');holder.innerHTML=renderAdsetPerformance();table.replaceWith(holder.querySelector('.adset-performance'));}return;}
  if(b.dataset.layout){explorerLayout=b.dataset.layout;page=0;return render();}
  if(b.dataset.metrics){compareMetrics=b.dataset.metrics;return render();}
  if(b.dataset.week){explorerWeek=b.dataset.week;page=0;return render();}
  if(b.dataset.grain){const inPeriodTable=!!b.closest('.period-grain-control');if(b.dataset.grainKind==='chart'){chartGrain=b.dataset.grain;if(inPeriodTable)periodValuesOpen=true;}else{explorerGrain=b.dataset.grain;tableSort=explorerGrain==='summary'?'spend':'period';page=0;}render();if(inPeriodTable)document.querySelector('.period-values')?.scrollIntoView({block:'start'});return;}
  if(b.dataset.view)return navigate(b.dataset.view);
  if(b.dataset.close)return $(b.dataset.close).close();
  if(b.dataset.detail!==undefined)return showDetail(b.dataset.detail);
  if(b.dataset.center){$('centerFilter').value=b.dataset.center;tableState='ALL';delivery='ALL';return navigate('creatives');}
  if(b.dataset.message){$('centerFilter').value=b.dataset.messageCenter;$('messageFilter').value=b.dataset.message;tableState='ALL';return navigate('creatives');}
  if(b.dataset.page){page+=b.dataset.page==='next'?1:-1;return render();}
  if(b.dataset.alert){alertMode=b.dataset.alert;tableState='ALL';page=0;return render();}
  if(b.dataset.copy!==undefined){const g=findCreative(b.dataset.copy);if(!g)return;try{await navigator.clipboard.writeText(brief(g));notify('Brief eksperimen disalin.');}catch{const area=document.createElement('textarea');area.value=brief(g);$('detailContent').appendChild(area);area.select();notify('Pilih dan salin teks brief yang muncul di bawah detail.');}return;}
  if(b.dataset.action==='missing'){alertMode='missing';tableState='ALL';return navigate('alerts');}
  if(b.dataset.action==='winners'){meetingTab='iterate';return navigate('meeting');}
  if(b.dataset.action==='settings')return settings();
});
document.addEventListener('toggle',e=>{if(e.target.matches?.('.period-primary'))periodValuesOpen=e.target.open;},true);
document.addEventListener('change',e=>{
  if(e.target.id==='adsetMetric'||e.target.id==='adsetOrder'||e.target.id==='adsetDelivery'){if(e.target.id==='adsetMetric')adsetMetric=e.target.value;else if(e.target.id==='adsetDelivery')adsetDelivery=e.target.value;else adsetOrder=e.target.value;const table=document.querySelector('.adset-performance');if(table){const holder=document.createElement('div');holder.innerHTML=renderAdsetPerformance();table.previousElementSibling.replaceWith(holder.querySelector('.section-heading'));table.replaceWith(holder.querySelector('.adset-performance'));}return;}
  if(e.target.id==='accountTrendMetric'){accountTrendMetric=e.target.value;render();return;}
  if(e.target.id==='periodShowDetails'){periodShowDetails=e.target.checked;document.querySelectorAll('.period-values').forEach(table=>table.classList.toggle('show-comparison-details',periodShowDetails));return;}
  if(e.target.id==='periodComparison'){periodCompareMode=e.target.value;periodValuesOpen=true;render();document.querySelector('.period-primary')?.scrollIntoView({block:'start'});return;}
  if(e.target.id==='matrixMetric'){matrixMetric=e.target.value;render();}
  if(e.target.id==='contentRankMetric'){contentRankMetric=e.target.value;render();}
  if(e.target.id==='contentRankLevel'){contentRankLevel=e.target.value;render();}
  if(e.target.id==='contentRankSort'){contentRankSort=e.target.value;render();}
  if(e.target.id==='tableState'){tableState=e.target.value;page=0;render();}
  if(e.target.id==='deliveryFilter'){delivery=e.target.value;page=0;render();}
  if(e.target.id==='tableSort'){tableSort=e.target.value;page=0;render();}
});
['centerFilter','startFilter','endFilter','objectiveFilter','resultFilter','roleFilter','messageFilter','brandFilter','accountFilter','campaignFilter'].forEach(id=>$(id).addEventListener('change',()=>{page=0;if(['startFilter','endFilter'].includes(id)){rollingPeriod=false;datePreset='custom';explorerWeek='ALL';}if(['objectiveFilter','brandFilter','accountFilter'].includes(id))updateOptions();render();}));
let searchTimer;$('searchFilter').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=0;render();},200);});
document.querySelectorAll('[data-work-view]').forEach(b=>b.onclick=()=>setWorkView(b.dataset.workView));
$('myScope').onclick=()=>{scope='MY';$('centerFilter').value='ALL';updateOptions();page=0;render();};$('allScope').onclick=()=>{scope='ALL';$('centerFilter').value='ALL';updateOptions();page=0;render();};
$('syncButton').onclick=sync;$('exportButton').onclick=exportCsv;$('settingsButton').onclick=settings;$('resetButton').onclick=reset;
$('settingsForm').onsubmit=e=>{e.preventDefault();config={target:+$('targetInput').value,cplTarget:+$('cplTargetInput').value,cpbTarget:+$('cpbTargetInput').value,cpbTargetVersion:2,minSpend:+$('spendInput').value,minResults:+$('resultsInput').value};try{localStorage.setItem('sparks-analysis-settings-v2',JSON.stringify(config));}catch{notify('Pengaturan berlaku untuk sesi ini; penyimpanan browser tidak tersedia.');}$('settingsDialog').close();render();};
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
sync();setInterval(sync,600000);
