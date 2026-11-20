const TREND_METRICS=[
  {key:'leadRate',label:'Results → Leads (%)',format:percent,color:'#438b80',hint:'Total Leads / total Results x 100%'},
  {key:'bookingRate',label:'Leads → Booking (%)',format:percent,color:'#8164ad',hint:'Total Booking / total Leads x 100%'},
  {key:'results',label:'Results',format:integer,color:'#73994b',hint:'Total Results per period'},
  {key:'leads',label:'Leads',format:integer,color:'#438b80',hint:'Total Leads per period'},
  {key:'booking',label:'Booking',format:integer,color:'#b3914d',hint:'Total Booking per period'},
  {key:'cpr',label:'CPR',format:money,color:'#73994b',hint:'Total spend ÷ Results'},
  {key:'cpl',label:'CPL',format:money,color:'#438b80',hint:'Total spend ÷ Leads'},
  {key:'cpb',label:'CPB',format:money,color:'#b3914d',hint:'Total spend ÷ Booking'}
];
let periodCompareMode='previous',periodValuesOpen=true,periodShowDetails=false,periodMetricGroup='outcomes';
const PERIOD_METRIC_GROUPS={outcomes:['spend','results','leads','booking'],costs:['cpr','cpl','cpb'],conversions:['leadRate','bookingRate']};
document.addEventListener('click',e=>{const b=e.target.closest('[data-period-group]');if(!b)return;periodMetricGroup=b.dataset.periodGroup;render();document.querySelector('.period-primary')?.scrollIntoView({block:'start'});});
const PeriodLearning=(()=>{
  const costKeys=['cpr','cpl','cpb'],ratioKeys=[...costKeys,'bookingRate','leadRate'];
  const shift=(day,n)=>{const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const dayCount=(start,end)=>start&&end&&start<=end?Math.round((Date.parse(end)-Date.parse(start))/86400000)+1:0;
  function previousRange(start,end,grain){
    if(grain!=='monthly'){const n=grain==='weekly'?-7:-1;return {start:shift(start,n),end:shift(end,n)};}
    const current=A.period(start,'monthly'),prev=A.period(shift(current.start,-1),'monthly');
    if(start===current.start&&end===current.end)return prev;
    const first=+start.slice(-2),last=Math.min(+end.slice(-2),+prev.end.slice(-2));
    if(first>last)return null;
    // Do not silently compare a 31-day slice to 28 days: trim both sides to matching month dates.
    return {start:prev.start.slice(0,8)+String(first).padStart(2,'0'),end:prev.start.slice(0,8)+String(last).padStart(2,'0'),currentEnd:end.slice(0,8)+String(last).padStart(2,'0')};
  }
  function value(s,key,mixed=false){return key==='spend'?(s.rows?s.spend:null):trendValue(s,key,mixed);}
  function daily(s,key,mixed=false){const v=value(s,key,mixed);return v===null?null:ratioKeys.includes(key)?v:s.days.size?v/s.days.size:null;}
  function delta(current,reference,key,reason=''){
    if(reason||current===null||reference===null)return {text:reason||'Belum dapat dibandingkan',tone:'neutral',strength:0};
    if(reference===0)return {text:current===0?'Tetap 0':'Naik dari 0 · % tidak dihitung',tone:'neutral',strength:0};
    const pct=(current/reference-1)*100;
    if(Math.abs(pct)<1e-9)return {text:'Tidak berubah · 0%',tone:'neutral',strength:0,pct:0};
    const better=costKeys.includes(key)?pct<0:pct>0;
    return {text:`${pct>0?'↑':'↓'} ${percent(Math.abs(pct))}`,tone:key==='spend'?'neutral':better?'better':'worse',strength:Math.min(Math.abs(pct),50)/50,pct};
  }
  function comparison(s,history,grain,total,mode,latest){
    const end=latest&&latest<s.end?latest:s.end;
    if(end<s.start||!s.rows)return {reason:'Tidak ada data periode ini'};
    if(mode==='average')return {current:s,reference:total,label:'Rata-rata rentang tanggal',mixed:A.aggregate([...s.items,...total.items]).mixed};
    const range=previousRange(s.start,end,grain);
    if(!range)return {reason:'Tanggal pembanding tidak tersedia'};
    const currentEnd=range.currentEnd||end;
    const current={...summaryAggregate(s.items.filter(r=>r.day<=currentEnd)),items:s.items.filter(r=>r.day<=currentEnd)};
    const items=history.filter(r=>r.day>=range.start&&r.day<=range.end),reference={...summaryAggregate(items),items};
    const reason=!reference.rows?'Data periode sebelumnya tidak tersedia':current.days.size!==dayCount(s.start,currentEnd)||reference.days.size!==dayCount(range.start,range.end)?'Hari dengan data belum lengkap':'';
    return {current,reference,reason,mixed:A.aggregate([...current.items,...items]).mixed,label:`${prettyDate(range.start)} – ${prettyDate(range.end)}`,currentLabel:currentEnd!==s.end?`Perubahan dihitung sampai ${prettyDate(currentEnd)}`:'',range};
  }
  return {costKeys,ratioKeys,shift,dayCount,previousRange,value,daily,delta,comparison};
})();
function trendHistoryRows(){
  const center=$('centerFilter').value,obj=$('objectiveFilter').value,type=$('resultFilter').value,role=$('roleFilter').value,brand=$('brandFilter').value,q=$('searchFilter').value.toLowerCase().trim(),msg=$('messageFilter').value;
  return rows.filter(r=>accountMatches(r)&&r.day&&workspaceMatches(r)&&campaignMatches(r)&&(center==='ALL'||r.center===center)&&objectiveMatches(r,obj)&&(type==='ALL'||r.resultType===type)&&(role==='ALL'||r.role===role)&&(brand==='ALL'||r.brand===brand)&&(msg==='ALL'||(msg==='MISSING'?!r.message:r.message===msg))&&(!q||`${r.ad} ${r.adCode} ${r.adset} ${r.campaign}`.toLowerCase().includes(q)));
}
function renderPeriodValues(series,total,mixed,items=selected,chosenMetrics=null,title='Performance by period'){
  const availableMetrics=chosenMetrics||[{key:'spend',label:'Spend',format:money},...TREND_METRICS],metrics=availableMetrics.filter(m=>periodMetricGroup==='all'||PERIOD_METRIC_GROUPS[periodMetricGroup]?.includes(m.key)),contexts=new Set(items.map(resultContext)),history=trendHistoryRows().filter(r=>contexts.has(resultContext(r))),latest=history.reduce((v,r)=>r.day>v?r.day:v,'');
  if(!metrics.length&&title!=='Performance by period')return '';
  const average={...total,items},isCost=k=>PeriodLearning.ratioKeys.includes(k);
  const format=(v,m)=>m.format===money?money(v):m.format===percent?percent(v):decimal(v);
  const shown=(s,m)=>{const reading=overviewReading(s,m.key),value=PeriodLearning.daily(s,m.key,mixed);return `<span ${reading.partial?'data-report-partial="true"':''} title="${esc(reading.note)}">${m.key==='bookingRate'&&!reading.partial?bookingRateMarkup(value,format(value,m)):format(value,m)}</span>${reading.partial?'<sup class="coverage-mark" aria-label="Incomplete report; see Data coverage">*</sup>':value===null?'<small class="report-state">No data / zero denominator</small>':''}`;};
  const shortDate=day=>new Date(day+'T00:00:00Z').toLocaleDateString('id-ID',{day:'numeric',month:'short',timeZone:'UTC'});
  const dates=(start,end)=>start===end?shortDate(start):`${shortDate(start)}–${shortDate(end)}`;
  return `<details class="card period-values compact-periods ${title==='Performance by period'?'period-primary':'period-context-table'} ${periodShowDetails?'show-comparison-details':''}" ${periodValuesOpen?'open':''}><summary>${esc(title)} <span>${series.length} periods · ${GRAINS[chartGrain]}</span></summary>${title==='Performance by period'?`<div class="period-metric-tabs scope-switch">${[['outcomes','Outcomes'],['costs','Costs'],['conversions','Conversions'],['all','All metrics']].map(([key,label])=>`<button data-period-group="${key}" class="${periodMetricGroup===key?'selected':''}">${label}</button>`).join('')}</div><div class="period-controls"><div class="period-grain-control">${grainControl('chart',chartGrain)}</div><label for="periodComparison">Compare with</label><select id="periodComparison"><option value="previous" ${periodCompareMode==='previous'?'selected':''}>Previous period</option><option value="average" ${periodCompareMode==='average'?'selected':''}>Selected range average</option></select><label class="period-detail-toggle"><input type="checkbox" id="periodShowDetails" ${periodShowDetails?'checked':''}> Show comparison values</label><p class="mini-note"><span class="period-good">Improved</span> / <span class="period-bad">Declined</span></p></div>`:''}<div class="table-wrap period-table-scroll"><table><thead><tr><th>Period</th>${metrics.map(m=>`<th class="num">${m.label}${!isCost(m.key)?'<small>daily average</small>':''}</th>`).join('')}</tr></thead><tbody><tr class="period-average"><td><b>Range average</b><small>${total.days.size} days with data</small></td>${metrics.map(m=>`<td class="num"><b>${shown(total,m)}</b></td>`).join('')}</tr>${[...series].reverse().map(s=>{
    const c=PeriodLearning.comparison(s,history,chartGrain,average,periodCompareMode,latest);
    const rangeLabel=c.range?dates(c.range.start,c.range.end):periodCompareMode==='average'?'rata-rata pilihan':'tidak tersedia';
    return `<tr class="period-data"><td title="${esc(periodText(s))}"><b>${esc(chartGrain==='monthly'?new Date(s.start+'T00:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}):dates(s.start,s.end))}</b><small>${s.days.size} days${s.partial?' · partial':''}</small><small class="period-vs period-comparison-detail">vs ${esc(rangeLabel)}</small>${c.currentLabel?`<small class="period-comparison-detail">${esc(c.currentLabel)}</small>`:''}</td>${metrics.map(m=>{
      const incomparable=c.mixed&&contextSensitive(m.key),partial=c.current&&overviewReading(c.current,m.key).partial||c.reference&&overviewReading(c.reference,m.key).partial,reason=c.reason||(incomparable?'Different Results types':partial?'Outcome coverage differs; change is not scored':'');
      const cv=c.current?PeriodLearning.daily(c.current,m.key,mixed):null,rv=c.reference?PeriodLearning.daily(c.reference,m.key,c.mixed):null;
      const d=PeriodLearning.delta(cv,rv,m.key,reason),style=d.tone==='neutral'?'':`background:rgba(${d.tone==='better'?'65,153,101':'202,83,75'},${.04+.16*d.strength})`;
      const display=PeriodLearning.daily(s,m.key,mixed),ref=format(rv,m);
      const shortened=c.currentLabel&&cv!==display;
      const title=`${m.label}${isCost(m.key)?'':' per hari'}: ${format(cv,m)} dibanding ${ref}. ${c.label||''}. ${d.text}. ${c.currentLabel||''}`;
      const deltaText=d.pct===0?'= 0%':d.pct!==undefined?d.text:rv===0&&cv!==null?(cv===0?'= 0':'Dari 0'):'—';
      return `<td class="num period-metric ${d.tone}" data-period-metric="${m.key}" style="${style}" title="${esc(title)}"><b class="period-main">${shown(s,m)}</b><div class="period-cell-foot"><span class="period-delta" aria-label="${esc(title)}">${esc(deltaText)}${shortened?'*':''}</span></div><small class="period-comparison-detail">${format(cv,m)} vs ${ref}${!isCost(m.key)?' / hari':''}${d.pct===undefined?` · ${esc(d.text)}`:''}</small>${shortened?'<small class="period-adjusted period-comparison-detail">*Bagian periode setara</small>':''}</td>`;
    }).join('')}</tr>`;
  }).join('')}</tbody></table></div>${periodCoveragePanel(series)}<details class="period-method"><summary>How to read this table</summary><p>Recorded outcomes adalah hasil yang sudah tersedia, bukan total akhir jika laporan masih kurang. Matched data menghitung biaya dan konversi dari baris laporan yang sama; arahkan kursor ke angkanya untuk melihat pembilang, penyebut, dan cakupan baris. Perubahan tidak diberi skor ketika cakupan salah satu periode belum lengkap.</p><p>Results, Leads, Booking, dan Spend: angka utama adalah rata-rata per hari. Leads → Booking (%) = total Booking / total Leads x 100%; tidak dibagi lagi dengan jumlah hari. Kenaikan rasio berwarna hijau dan penurunan merah; perubahan ditampilkan relatif terhadap pembanding. CPR/CPL/CPB = total Spend ÷ total hasil. Persentase membandingkan angka utama dengan pembanding pada baris tersebut, bukan sekadar baris sebelumnya yang terlihat.</p><p>Contoh: 9 Booking dalam 7 hari = 1,29/hari. Jika sebelumnya 19 Booking dalam 7 hari, turun 52,63% (merah). Sementara 9 Booking dalam 5 hari = 1,8/hari; dibanding 4 Booking dalam 5 hari yang sama pada minggu sebelumnya, naik 125% (hijau).</p><p>Weekly mengikuti Senin–Minggu. Minggu parsial dibandingkan dengan hari yang sama seminggu sebelumnya. Bulan parsial memakai tanggal yang sama pada bulan sebelumnya, dibatasi tanggal yang tersedia di kedua bulan. Tanda * berarti hanya bagian periode setara yang dipakai untuk perubahan; aktifkan detail untuk melihat angkanya. Data pembanding boleh berasal dari sebelum tanggal awal filter, dengan filter lainnya tetap sama. Angka periode terpilih tidak berubah.</p><p>Hijau: hasil per hari naik atau biaya per hasil turun. Merah: sebaliknya. Intensitas warna dibatasi pada perubahan 50%. Tanda — berarti belum dapat dibandingkan; lihat detail untuk penyebabnya. Data kosong dan pembanding nol tidak menghasilkan warna performa. Rata-rata pilihan memakai days with data saja, termasuk periode yang sedang dinilai.</p></details></details>`;
}
function trendValue(s,key,mixed=false){
  if(!s.rows||contextSensitive(key)&&mixed)return null;
  return overviewReading(s,key).value;
}
function metricChart(series,metric,mixed){
  const values=series.map(s=>mixed&&['results','cpr','leadRate'].includes(metric.key)?null:overviewReading(s,metric.key).value);
  if(!values.some(v=>v!==null))return `<div class="chart-empty">${mixed&&['cpr','results','leadRate'].includes(metric.key)?'Pilih brand, objective dan jenis Results yang sebanding.':'Belum ada nilai yang dapat dihitung pada periode ini.'}</div>`;
  const w=430,h=178,left=65,right=14,top=24,bottom=28,max=Math.max(1,...values.filter(v=>v!==null),metric.key==='cpr'?config.target:0)*1.15;
  const x=i=>series.length===1?(left+w-right)/2:left+i*(w-left-right)/(series.length-1),y=v=>h-bottom-v/max*(h-top-bottom);
  const compact=v=>metric.format===percent?percent(v):metric.format===money?'Rp'+new Intl.NumberFormat('id-ID',{notation:'compact',maximumFractionDigits:1}).format(v):new Intl.NumberFormat('id-ID',{notation:'compact',maximumFractionDigits:1}).format(v);
  let path='',pen=false;values.forEach((v,i)=>{if(v===null){pen=false;return;}path+=`${pen?' L':' M'} ${x(i)} ${y(v)}`;pen=true;});
  const ticks=[0,max/2,max];
  return `<svg class="metric-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tren ${metric.label} ${GRAINS[chartGrain]}">
    ${ticks.map(v=>`<line x1="${left}" x2="${w-right}" y1="${y(v)}" y2="${y(v)}" stroke="#ecf0e6"/><text x="${left-8}" y="${y(v)+3}" text-anchor="end" fill="#8b9780" font-size="9">${compact(v)}</text>`).join('')}
    ${metric.key==='cpr'?`<line x1="${left}" x2="${w-right}" y1="${y(config.target)}" y2="${y(config.target)}" stroke="#b59a6b" stroke-dasharray="4 4"/><text x="${w-right}" y="${y(config.target)-5}" text-anchor="end" fill="#9a865f" font-size="8">Target ${money(config.target)}</text>`:''}
    <path d="${path}" fill="none" stroke="${metric.color}" stroke-width="2.5" stroke-linejoin="round"/>
    ${values.map((v,i)=>v===null?'':`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${overviewReading(series[i],metric.key).partial?'#94aaa1':metric.key==='bookingRate'?`var(--booking-${CostTargets.bookingRateTier(v)})`:metric.key==='leadRate'&&v<80?'#bf554b':metric.color}"><title>${esc(periodText(series[i]))}${series[i].partial?' · period clipped by date range':''}: ${metric.label} ${metric.format(v)}${series[i].coverage?.[metric.key]?.rows<series[i].rows?' · '+esc(overviewReading(series[i],metric.key).note):''}</title></circle>`).join('')}
    <text x="${left}" y="${h-6}" fill="#8b9780" font-size="9">${esc(series[0].start)}</text>${series.length>1?`<text x="${w-right}" y="${h-6}" text-anchor="end" fill="#8b9780" font-size="9">${esc(series.at(-1).end)}</text>`:''}
  </svg>`;
}
function contextPanels(panels){return (panels[0]||'')+(panels.length>1?`<details class="more-result-contexts"><summary>More result contexts (${panels.length-1})</summary>${panels.slice(1).join('')}</details>`:'');}
function renderTrends(){
  const series=overviewPeriods(selected),total=summaryAggregate(selected),contexts=overviewGroups(selected,'results'),mixed=contexts.length>1;
  if(!series.length)return '';
  const charts=TREND_METRICS.map(metric=>{
    const groups=overviewGroups(selected,metric.key);
    return `<section class="card trend-card" data-metric="${metric.key}"><div class="card-heading"><div><h2 title="${esc(metric.hint)}">${metric.label}</h2></div><span class="pill">${GRAINS[chartGrain]}</span></div><div class="card-body">${contextPanels(groups.map(g=>{
      const points=overviewPeriods(g.items),hasPartial=points.some(p=>overviewReading(p,metric.key).partial);
      return `<div class="trend-context">${groups.length>1?`<h3>${esc(contextLabel(g.items[0]))}</h3>`:''}${metricChart(points,metric,false)}</div>`;
    }))}</div></section>`;
  }).join('');
  const common=[{key:'spend',label:'Spend',format:money},...TREND_METRICS.filter(m=>!contextSensitive(m.key))];
  const tables=mixed?renderPeriodValues(series,total,false,selected,common)+`<div class="period-contexts">${contexts.map((g,i)=>{const table=renderPeriodValues(overviewPeriods(g.items),summaryAggregate(g.items),false,g.items,TREND_METRICS.filter(m=>contextSensitive(m.key)),'Results breakdown / '+contextLabel(g.items[0]));return i?table.replace(' open><summary>','><summary>'):table;}).join('')}</div>`:renderPeriodValues(series,total,false);
  return section('Main metric trends','',grainControl('chart',chartGrain))+`<div class="trend-grid">${charts}</div>${tables}`;
}

function periodCoveragePanel(series){
  const missing=series.filter(s=>s.leadRows<s.rows||s.bookingRows<s.rows);
  if(!missing.length)return '';
  return `<details class="period-coverage"><summary>* Data coverage · ${missing.length} periods</summary><p>A marked value uses the available reports only. Changes involving incomplete reports stay unscored. Combined content with a complete shared report is counted once and can be compared normally.</p><table><thead><tr><th>Period</th><th>Leads coverage</th><th>Booking coverage</th></tr></thead><tbody>${missing.map(s=>`<tr><td>${esc(s.start)} – ${esc(s.end)}</td><td>${s.leadRows} / ${s.rows} rows</td><td>${s.bookingRows} / ${s.rows} rows</td></tr>`).join('')}</tbody></table></details>`;
}
