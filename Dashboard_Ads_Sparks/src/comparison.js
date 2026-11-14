let explorerLayout='compare',compareMetrics='main',comparisonDetails=[];
const entityKey=r=>JSON.stringify([r.center,r.brand,r.account,r.campaign,r.adset,r.ad,r.resultType,...A.identitySuffix(r)]);
const shortWeek=w=>w.weekNum===null?'Week belum diisi':`Week ${w.weekNum}`;
function comparisonPeriods(){
  if(explorerGrain==='weekly')return [...new Map(periodCreatives.filter(g=>explorerWeek==='ALL'||g.weekKey===explorerWeek).map(g=>[g.weekKey,g])).values()].sort((a,b)=>a.weekYear.localeCompare(b.weekYear)||(a.weekNum??99)-(b.weekNum??99)).map(g=>({key:g.weekKey,label:shortWeek(g),year:g.weekYear,start:g.start,end:g.end,partial:g.partial,contains:r=>A.sheetWeekKey(r)===g.weekKey&&r.day>=g.start&&r.day<=g.end}));
  const dates=selected.map(r=>r.day).sort(),end=dates.at(-1);
  if(!end)return [];
  return [1,3,7,14,30].map(n=>{const d=new Date(end+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-n+1);const desired=d.toISOString().slice(0,10),start=$('startFilter').value&&$('startFilter').value>desired?$('startFilter').value:desired;return {key:String(n),label:`${n}D`,start,end,partial:start!==desired,contains:r=>r.day>=start&&r.day<=end};});
}
function comparisonData(){
  const periods=comparisonPeriods();comparisonDetails=[];
  const entities=A.group(selected,entityKey).map(group=>{
    const original=creatives.find(g=>g.key===JSON.stringify([...JSON.parse(group.key),'']));
    if(!original)return null;
    const cells=periods.map(p=>{
      const items=group.items.filter(p.contains);if(!items.length)return null;
      const summary=A.aggregate(items),first=items[0],last=[...items].sort((a,b)=>b.day.localeCompare(a.day))[0],peers=base.filter(r=>p.contains(r)&&entityKey(r)!==group.key&&r.center===first.center&&r.brand===first.brand&&r.objective===first.objective&&r.resultType===first.resultType&&r.format===first.format);
      const denominator=rows.filter(r=>temporalFilter(r)&&p.contains(r)&&r.brand===first.brand&&r.account===first.account&&r.campaign===first.campaign&&r.adset===first.adset).reduce((s,r)=>s+r.spend,0),benchmark=A.aggregate(peers);
      let cell={...original,...summary,items,start:p.start,end:p.end,partial:p.partial,comparisonLabel:p.label,grain:explorerGrain,weekNum:explorerGrain==='weekly'?first.weekNum:null,weekYear:explorerGrain==='weekly'?first.day.slice(0,4):null,share:A.ratio(summary.spend,denominator,100),benchmark,state:A.state({...summary,items},config),diagnosis:A.diagnose({...summary,items},benchmark,config),id:`comparison_${comparisonDetails.length}`};
      cell=applyRules(cell,peers);comparisonDetails.push(cell);return cell;
    });
    const visible=group.items.filter(r=>periods.some(p=>p.contains(r))),summary=A.aggregate(visible);
    const latest=explorerGrain==='daily'?cells[0]:cells.at(-1);
    return {...original,...summary,cells,latest,lastDelivery:latest?.lastDelivery||original.lastDelivery};
  }).filter(g=>g&&g.cells.some(Boolean)).filter(g=>(tableState==='ALL'||(tableState==='EVALUATE'?g.latest?.creativeEvaluation:g.latest?.state===tableState))&&(delivery==='ALL'||g.lastDelivery===delivery));
  entities.sort((a,b)=>tableSort==='cpr'?(b.latest?.cpr??-1)-(a.latest?.cpr??-1):tableSort==='share'?(b.latest?.share??0)-(a.latest?.share??0):b[['results','leads'].includes(tableSort)?tableSort:'spend']-a[['results','leads'].includes(tableSort)?tableSort:'spend']);
  const totals=periods.map(p=>{const items=entities.flatMap(g=>g.items.filter(p.contains)),s=A.aggregate(items),sets=new Set(items.map(r=>JSON.stringify([r.brand,r.account,r.campaign,r.adset])));return {...s,share:sets.size===1?entities.reduce((n,g)=>n+(g.cells[periods.indexOf(p)]?.share||0),0):null};});
  return {periods,entities,totals};
}
function comparisonMetricList(){
  const main=[['share','Spend share',percent],['cpr','CPR',money],['cpl','CPL',money],['cpb','CPB',money],['spend','Spend',money],['results','Results',integer],['leads','Leads',integer],['booking','Booking',integer],['bookingRate','Leads → Booking (%)',percent],['leadRate','Results → Leads',percent]];
  return compareMetrics==='additional'?[['ctr','CTR',percent],['hook','Hook rate',percent],['view','Views rate',percent],['frequency','Frequency ≈',decimal]]:main;
}
function comparisonValue(s,key){if(!s||!s.rows)return null;if(key==='leads'&&s.leadRows!==s.rows||key==='booking'&&s.bookingRows!==s.rows)return null;return s[key];}
function renderComparison(){
  const {periods,entities,totals}=comparisonData(),metrics=comparisonMetricList(),limit=30,pages=Math.max(1,Math.ceil(entities.length/limit));page=Math.min(page,pages-1);
  const multiYear=new Set(periods.map(p=>p.year).filter(Boolean)).size>1;
  let html=`<div class="comparison-intro"><div><h2>Breakdown · ${explorerGrain==='weekly'?'Weekly':'Trend 1D–30D'}</h2><small>${entities.length} ad · status pada ${explorerGrain==='weekly'?'minggu terakhir yang ditampilkan':'1D terbaru'} · urutan mengikuti filter sort</small></div><div class="scope-switch"><button data-metrics="main" class="${compareMetrics==='main'?'selected':''}">Main metrics</button><button data-metrics="additional" class="${compareMetrics==='additional'?'selected':''}">Additional metrics</button></div></div>`;
  if(!entities.length)return html+empty('No creatives for this selection','Sesuaikan filter status, minggu, atau rentang tanggal.');
  const cell=(s,key,format,index)=>{
    const v=comparisonValue(s,key),ref=CostTargets.limit(key,config);
    const heat=metricRuleColor(s,key)|| (v===null?'':['cpr','cpl','cpb'].includes(key)&&ref>0?(v<=ref?'good-heat':'bad-heat'):'');
    return `<td class="num ${heat}" data-metric="${key}">${s?`<button class="metric-value" data-detail="${s.id}" aria-label="${esc(s.ad)} ${esc(periods[index].label)} ${key}: ${format(v)}">${displayMetric(s,key,format)}</button>`:'—'}</td>`;
  };
  html+=`<section class="card compare-card"><div class="table-wrap compare-scroll"><table class="comparison-matrix"><thead><tr><th rowspan="2" class="frozen-name">Ad name</th><th rowspan="2" class="frozen-status">Status terbaru</th><th rowspan="2">Umur ad</th>${metrics.map(([k,label])=>`<th class="metric-group" data-metric="${k}" colspan="${periods.length}">${label}</th>`).join('')}</tr><tr>${metrics.map(([key])=>periods.map(p=>`<th data-metric="${key}" class="period-cell" title="${esc(p.start+' – '+p.end+(p.partial?' · parsial karena filter tanggal':''))}">${esc(p.label)}${explorerGrain==='daily'?`<small>${prettyDate(p.start)} – ${prettyDate(p.end)}${p.partial?' · parsial':''}</small>`:multiYear?`<small>${p.year}</small>`:''}</th>`).join('')).join('')}</tr></thead><tbody><tr class="comparison-total"><td class="frozen-name"><b>Total ad terfilter</b></td><td class="frozen-status">${entities.length} ad</td><td>—</td>${metrics.map(([key,,f])=>totals.map(s=>`<td class="num" data-metric="${key}">${displayMetric(s,key,f)}</td>`).join('')).join('')}</tr>${entities.slice(page*limit,(page+1)*limit).map(g=>`<tr><td class="frozen-name"><b>${esc(g.adCode)}</b><small title="${esc(g.ad)}">${esc(g.ad)}</small><small>${esc(g.center)} · ${esc(g.adset)}</small>${accountBadge(g.account)}<small>${money(g.spend)} pada periode tampil</small></td><td class="frozen-status">${g.latest?actionStatus(g.latest):'<span class="pill EMPTY">Tidak ada data terbaru</span>'}<small>${esc(g.message||'Key message belum diisi')}</small></td><td class="num age-column">${ageCell(g.latest||g)}<small>sejak publish</small><small>${(g.latest||g).history?.activeDays??0} hari tercatat aktif</small></td>${metrics.map(([key,,f])=>g.cells.map((s,i)=>cell(s,key,f,i)).join('')).join('')}</tr>`).join('')}</tbody></table></div><div class="pager"><span>${page+1} / ${pages} · ${entities.length} ad</span><button class="button" data-page="prev" ${page===0?'disabled':''}>←</button><button class="button" data-page="next" ${page===pages-1?'disabled':''}>→</button></div></section>`;
  return html;
}
function comparisonExportRows(){const {entities}=comparisonData();return entities.flatMap(g=>g.cells.filter(Boolean));}
