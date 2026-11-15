/* Center-period comparisons retain report ownership and align comparison dates. */
const CenterPeriods=(()=>{
  const counts=MetricScorecards.counts, rates=MetricScorecards.rates;
  const days=(start,end)=>Array.from({length:PeriodLearning.dayCount(start,end)},(_,i)=>PeriodLearning.shift(start,i));
  const identity=r=>JSON.stringify([r.center,r.brand]);
  function build(items,{from,to,latest,grain='weekly',entities=[]},aggregate=scorecardAggregate){
    const end=latest&&latest<to?latest:to;
    if(!from||!end||from>end)return {periods:[],groups:[],items:[],aggregate};
    const chosen=items.filter(r=>r.day>=from&&r.day<=end),byPeriod=new Map(),byCenter=new Map();
    for(const r of entities){const key=identity(r);if(!byCenter.has(key))byCenter.set(key,{key,center:r.center,brand:r.brand,items:[],buckets:new Map()});}
    for(const r of chosen){
      const pk=A.period(r.day,grain).start,key=identity(r);
      if(!byPeriod.has(pk))byPeriod.set(pk,[]);byPeriod.get(pk).push(r);
      if(!byCenter.has(key))byCenter.set(key,{key,center:r.center,brand:r.brand,items:[],buckets:new Map()});
      const group=byCenter.get(key);group.items.push(r);
      if(!group.buckets.has(pk))group.buckets.set(pk,[]);group.buckets.get(pk).push(r);
    }
    const periods=[];
    for(let cursor=from;cursor<=end;){
      const natural=A.period(cursor,grain),start=natural.start<from?from:natural.start,last=natural.end>end?end:natural.end;
      const own=byPeriod.get(natural.start)||[],nums=new Set(own.map(r=>r.weekNum));
      const number=nums.size===1&&Number.isInteger([...nums][0])?[...nums][0]:null;
      periods.push({key:natural.start,start,end:last,natural,grain,number,mappingIssue:grain==='weekly'&&number===null,
        partial:start!==natural.start||last!==natural.end,dates:days(start,last)});
      cursor=PeriodLearning.shift(natural.end,1);
    }
    const cell=(p,list)=>({period:p,items:list,s:aggregate(list)});
    const groups=[...byCenter.values()].map(g=>({...g,cells:periods.map(p=>cell(p,g.buckets.get(p.key)||[]))}));
    const total={key:'ALL',center:'All centers',brand:'',items:chosen,cells:periods.map(p=>cell(p,byPeriod.get(p.key)||[]))};
    return {periods,groups,total,items:chosen,aggregate};
  }
  function read(cell,key,basis='total'){
    if(!cell)return {value:null,partial:false,reason:'No data'};
    const r=MetricScorecards.read(cell.s,key),expected=cell.period.dates.length,observed=cell.s.days.size;
    const missing=observed<expected&&cell.s.rows>0;
    const value=basis==='daily'&&counts.has(key)&&Number.isFinite(r.value)?r.value/observed:r.value;
    return {...r,value,partial:r.partial||missing,reason:missing?`${observed}/${expected} days with data. Missing days are not zero.`:r.reason,
      note:[missing?`${observed}/${expected} days with data`:'',r.note||r.reason].filter(Boolean).join(' · ')};
  }
  function compare(group,index,key,basis='total',aggregate=scorecardAggregate){
    const current=group.cells[index],previous=group.cells[index-1];
    const none=reason=>({text:'—',tone:'neutral',reason,current:null,previous:null});
    if(!current||!previous)return none('Previous period is outside the selected date range');
    const p=current.period,q=previous.period;
    if(p.mappingIssue||q.mappingIssue)return none('Week Num is missing or inconsistent');
    const pairs=p.dates.map(day=>{
      if(p.grain!=='monthly')return [day,PeriodLearning.shift(day,p.grain==='weekly'?-7:-1)];
      const offset=Number(day.slice(-2)),last=Number(q.natural.end.slice(-2));
      return offset>last?null:[day,q.natural.start.slice(0,8)+String(offset).padStart(2,'0')];
    }).filter(Boolean);
    if(!pairs.length||pairs.some(([,day])=>day<q.start||day>q.end))return none('Matching dates are outside the selected date range');
    const pick=(cell,ds)=>{const wanted=new Set(ds),items=cell.items.filter(r=>wanted.has(r.day));return {items,s:aggregate(items),period:{...cell.period,dates:ds}};};
    const cur=pick(current,pairs.map(d=>d[0])),ref=pick(previous,pairs.map(d=>d[1]));
    const a=read(cur,key,basis),b=read(ref,key,basis);
    const dateInfo={dates:cur.period.dates,referenceDates:ref.period.dates};
    const different=contextSensitive(key)&&A.aggregate([...cur.items,...ref.items]).mixed;
    const reason=different?'Different Results contexts':a.partial||b.partial?'Incomplete reports or missing days':!Number.isFinite(a.value)||!Number.isFinite(b.value)?a.reason||b.reason||'No data / zero denominator':'';
    if(reason)return {...none(reason),...dateInfo};
    const diff=a.value-b.value,flat=Math.abs(diff)<1e-9;
    const tone=flat||key==='spend'?'neutral':(PeriodLearning.costKeys.includes(key)?diff<0:diff>0)?'better':'worse';
    const pct=b.value===0?null:diff/b.value*100;
    const text=rates.has(key)?(flat?'0':(diff>0?'↑ ':'↓ ')+decimal(Math.abs(diff)))+' pp':flat?'0%':b.value===0?'↑ from 0':(pct>0?'↑ ':'↓ ')+percent(Math.abs(pct));
    return {text,tone,pct,diff,current:a.value,previous:b.value,...dateInfo,reason:''};
  }
  return {build,read,compare,identity,counts,rates};
})();

const CENTER_PERIOD_PAIRS={
  leads:{label:'Leads & CPL',keys:['leads','cpl']},
  booking:{label:'Booking & CPB',keys:['booking','cpb']},
  results:{label:'Results & CPR',keys:['results','cpr']},
  conversions:{label:'Conversions',keys:['leadRate','bookingRate']},
  spend:{label:'Spend',keys:['spend']}
};
let centerPeriodGrain='weekly',centerPeriodPair='leads',centerPeriodBasis='total',centerPeriodOffset=0,centerPeriodSort='center',centerPeriodContext='ALL',centerPeriodRangeKey='';
const centerPeriodName=k=>SCORECARD_METRICS.find(m=>m[0]===k)?.[1]||k;
const centerPeriodFormat=(v,k)=>scorecardFormat(v,k);
function centerPeriodHeading(p){
  const date=new Date(p.start+'T00:00:00Z');
  const name=p.grain==='weekly'?(p.number===null?'Week ?':'Week '+p.number):p.grain==='monthly'?date.toLocaleDateString('en-GB',{month:'long',timeZone:'UTC'}):scorecardDate(p.start);
  const detail=p.grain==='daily'?date.toLocaleDateString('en-GB',{weekday:'short',timeZone:'UTC'})+' · '+p.start.slice(0,4):scorecardDate(p.start)+'–'+scorecardDate(p.end)+' · '+p.start.slice(0,4)+(p.start.slice(0,4)!==p.end.slice(0,4)?'/'+p.end.slice(0,4):'');
  return `<b>${esc(name)}</b><small>${esc(detail)}</small>${p.partial?'<span class="cp-partial">'+(p.start===p.natural.start?'To date':'Partial')+'</span>':''}`;
}
function renderCenterPeriodTable(model,groups,periods,indexes,key){
  const showBrand=new Set(groups.map(g=>g.brand)).size>1;
  const count=CenterPeriods.counts.has(key),basis=count&&centerPeriodBasis==='daily'?'Daily average':count?'Period total':'Ratio of totals';
  const format=v=>centerPeriodFormat(v,key),last=indexes.at(-1),known=groups.flatMap(g=>indexes.map(i=>CenterPeriods.read(g.cells[i],key,centerPeriodBasis))).filter(r=>!r.partial&&r.value!==null).map(r=>r.value),max=Math.max(1,...known);
  const cell=(g,i)=>{
    const c=g.cells[i],r=CenterPeriods.read(c,key,centerPeriodBasis),tone=r.partial?'neutral':MetricScorecards.tone(c.s,key);
    const target=['cpr','cpl','cpb','leadRate'].includes(key),toneClass=target?'cp-'+tone:'';
    const tip=[r.note||r.reason,Number.isFinite(r.value)&&target?scorecardTarget(key):''].filter(Boolean).join(' · ');
    return `<td class="num cp-value ${toneClass}" data-cp-value="${key}" data-cp-center="${esc(g.key)}" data-cp-period="${i}" title="${esc(tip)}"><b>${format(r.value)}</b>${r.partial?'<sup class="coverage-mark">*</sup>':''}${!target&&key!=='spend'&&r.value!==null&&!r.partial?`<span class="cp-bar" aria-hidden="true"><i style="width:${Math.max(0,r.value/max*100)}%"></i></span>`:''}</td>`;
  };
  const change=g=>{
    const d=CenterPeriods.compare(g,last,key,centerPeriodBasis,model.aggregate),dateLabel=ds=>ds?.length?`${scorecardDate(ds[0])}–${scorecardDate(ds.at(-1))}`:'';
    const explanation=d.reason||`${format(d.current)} vs ${format(d.previous)}${count&&centerPeriodBasis==='daily'?' / day':''}; ${dateLabel(d.dates)} vs ${dateLabel(d.referenceDates)}`;
    return `<td class="num cp-change ${d.tone}" title="${esc(explanation)}"><b>${esc(d.text)}</b>${d.current!==null?`<small>${format(d.current)} <span>vs</span> ${format(d.previous)}</small>`:'<small>Not comparable</small>'}</td>`;
  };
  return `<section class="card cp-metric-card" data-cp-metric="${key}"><div class="cp-metric-heading"><h3>${centerPeriodName(key)}</h3><small>${basis}</small></div><div class="cp-scroll" role="region" aria-label="${centerPeriodName(key)} by center and ${centerPeriodGrain} period" tabindex="0"><table class="cp-table"><caption class="sc-sr">${centerPeriodName(key)} by center. ${basis}. Change compares matching dates in the latest displayed period with the preceding period in the selected range.</caption><thead><tr><th scope="col">Center</th>${periods.map(p=>`<th scope="col" class="num">${centerPeriodHeading(p)}</th>`).join('')}<th scope="col" class="num cp-change-heading">${centerPeriodGrain==='daily'?'DoD':centerPeriodGrain==='weekly'?'WoW':'MoM'} Δ<small>Matched ${centerPeriodGrain==='weekly'?'weekdays':'dates'}</small></th></tr></thead><tbody>${groups.map(g=>`<tr><th scope="row" title="${esc(labels[g.center]||g.center)}"><b>${esc(g.center)}</b>${showBrand?`<small>${esc(g.brand==='English'?'Sparks English':g.brand)}</small>`:''}</th>${indexes.map(i=>cell(g,i)).join('')}${change(g)}</tr>`).join('')}</tbody>${groups.length>1?`<tfoot><tr><th scope="row">All centers</th>${indexes.map(i=>cell(model.total,i)).join('')}${change(model.total)}</tr></tfoot>`:''}</table></div></section>`;
}
function renderCenterPeriods(){
  const from=$('startFilter').value,to=$('endFilter').value;
  const rangeKey=JSON.stringify([from,to,...['centerFilter','accountFilter','brandFilter','campaignFilter','objectiveFilter','resultFilter','roleFilter','messageFilter','searchFilter'].map(id=>$(id).value),scope,workView]);
  if(rangeKey!==centerPeriodRangeKey){centerPeriodOffset=0;centerPeriodRangeKey=rangeKey;}
  const contexts=[...new Map(selected.map(r=>[resultContext(r),r])).entries()];
  if(centerPeriodContext!=='ALL'&&!contexts.some(([k])=>k===centerPeriodContext))centerPeriodContext='ALL';
  const items=centerPeriodContext==='ALL'?selected:selected.filter(r=>resultContext(r)===centerPeriodContext);
  const history=trendHistoryRows().filter(r=>centerPeriodContext==='ALL'||resultContext(r)===centerPeriodContext);
  const model=CenterPeriods.build(items,{from,to,latest:latestSourceDay(),grain:centerPeriodGrain,entities:history});
  const pageSize=4,pages=Math.max(1,Math.ceil(model.periods.length/pageSize));centerPeriodOffset=Math.max(0,Math.min(centerPeriodOffset,pages-1));
  const end=model.periods.length-centerPeriodOffset*pageSize,start=Math.max(0,end-pageSize),periods=model.periods.slice(start,end),indexes=periods.map((p,i)=>start+i),last=indexes.at(-1);
  const keys=CENTER_PERIOD_PAIRS[centerPeriodPair].keys;
  const sorts=[['center','Center A–Z'],...keys.flatMap(k=>[[k+':desc','Highest '+centerPeriodName(k)],[k+':asc','Lowest '+centerPeriodName(k)]])];
  if(!sorts.some(([k])=>k===centerPeriodSort))centerPeriodSort='center';
  const groups=[...model.groups].sort((a,b)=>{
    if(centerPeriodSort!=='center'){
      const [key,dir]=centerPeriodSort.split(':'),x=CenterPeriods.read(a.cells[last],key,centerPeriodBasis),y=CenterPeriods.read(b.cells[last],key,centerPeriodBasis);
      const xv=x.partial?null:x.value,yv=y.partial?null:y.value;
      if(xv===null&&yv!==null)return 1;if(yv===null&&xv!==null)return -1;
      if(xv!==null&&yv!==null&&xv!==yv)return (dir==='asc'?1:-1)*(xv-yv);
    }
    return a.center.localeCompare(b.center)||a.brand.localeCompare(b.brand);
  });
  const choices=(opts,current)=>opts.map(([v,label])=>`<option value="${esc(v)}" ${current===v?'selected':''}>${esc(label)}</option>`).join('');
  const controls=`<div class="cp-heading"><div><h2>Center performance by period</h2><p>${esc(scorecardDate(from))} – ${esc(scorecardDate(to))} · ${new Set(groups.map(g=>g.center)).size} centers</p></div><div class="scope-switch" role="group" aria-label="Center comparison period">${['daily','weekly','monthly'].map(g=>`<button data-cp-grain="${g}" aria-pressed="${g===centerPeriodGrain}" class="${g===centerPeriodGrain?'selected':''}">${GRAINS[g]}</button>`).join('')}</div></div><div class="cp-controls"><div class="scope-switch cp-pairs" role="group" aria-label="Center comparison metrics">${Object.entries(CENTER_PERIOD_PAIRS).map(([v,p])=>`<button data-cp-pair="${v}" aria-pressed="${centerPeriodPair===v}" class="${centerPeriodPair===v?'selected':''}">${p.label}</button>`).join('')}</div><div class="cp-options">${centerPeriodGrain!=='daily'?`<label>Counts<select id="centerPeriodBasis">${choices([['total','Period totals'],['daily','Daily averages']],centerPeriodBasis)}</select></label>`:''}<label>Sort latest period<select id="centerPeriodSort">${choices(sorts,centerPeriodSort)}</select></label>${contexts.length>1?`<label>Results context<select id="centerPeriodContext">${choices([['ALL','All contexts'],...contexts.map(([k,r])=>[k,contextLabel(r)])],centerPeriodContext)}</select></label>`:''}</div></div>`;
  if(!periods.length||!groups.length)return `<div class="cp-panel">${controls}${empty('No center data for this selection','Adjust the date range or filters.')}</div>`;
  const missing=groups.flatMap(g=>indexes.flatMap(i=>{const c=g.cells[i],bad=keys.filter(k=>CenterPeriods.read(c,k,centerPeriodBasis).partial);return bad.length?[{g,c,bad}]:[];}));
  const first=periods[0],latest=periods.at(-1);
  const alignment=CenterPeriods.compare(groups[0],last,keys[0],centerPeriodBasis,model.aggregate),dates=ds=>scorecardDate(ds[0])+(ds.length>1?'\u2013'+scorecardDate(ds.at(-1)):'');
  const windowNote=alignment.dates?`<span class="cp-window">${centerPeriodGrain==='weekly'?'WoW':centerPeriodGrain==='monthly'?'MoM':'DoD'} \u0394: ${dates(alignment.dates)} vs ${dates(alignment.referenceDates)}</span>`:'';
  const tools=`<div class="cp-toolbar"><div class="cp-toolbar-notes">${windowNote}<div class="cp-legend"><span><i class="cp-legend-good"></i>On target</span><span><i class="cp-legend-bad"></i>Above cost / below conversion target</span><span>Δ <b class="period-good">Improved</b> / <b class="period-bad">Declined</b></span></div></div><div class="cp-pages"><button class="button secondary" data-cp-page="older" aria-label="Earlier periods" ${start===0?'disabled':''}>←</button><span aria-live="polite">${scorecardDate(first.start)}–${scorecardDate(latest.end)}<small>${start+1}–${end} of ${model.periods.length} periods</small></span><button class="button secondary" data-cp-page="newer" aria-label="Later periods" ${centerPeriodOffset===0?'disabled':''}>→</button></div></div>`;
  return `<div class="cp-panel">${controls}${tools}<div class="cp-grid ${keys.length===1?'cp-single':''}">${keys.map(k=>renderCenterPeriodTable(model,groups,periods,indexes,k)).join('')}</div>${missing.length?`<details class="cp-help"><summary>* Data coverage · ${missing.length} center-periods</summary><div class="table-wrap"><table><thead><tr><th>Center</th><th>Dates</th><th>Metrics</th><th>Coverage</th></tr></thead><tbody>${missing.map(({g,c,bad})=>`<tr><td>${esc(g.center)} · ${esc(g.brand)}</td><td>${c.period.start} – ${c.period.end}</td><td>${bad.map(centerPeriodName).join(', ')}</td><td>${bad.map(k=>esc(CenterPeriods.read(c,k,centerPeriodBasis).note)).filter((v,i,a)=>a.indexOf(v)===i).join('<br>')}</td></tr>`).join('')}</tbody></table></div></details>`:''}${periods.some(p=>p.mappingIssue)?'<p class="cp-note">Week ? means Week Num is missing or inconsistent in Raw Data.</p>':''}<details class="cp-help"><summary>How to read this comparison</summary><p>Every cell follows the selected filters and date range. Accounts are combined within each center; brands remain separate. Both tables keep the same center order. Sorting uses the latest displayed period; missing or incomplete values sort last.</p><p>Period totals show Spend, Results, Leads and Booking totals. Daily averages divide those totals by days with data. CPR = Spend ÷ Results; CPL = Spend ÷ Leads; CPB = Spend ÷ Booking. Results → Leads = Leads ÷ Results; Leads → Booking = Booking ÷ Leads. Ratios always use pooled totals.</p><p>The change column compares the latest displayed period with the preceding calendar period within your selected range, including one on the previous page. Weekly changes compare matching weekdays; monthly changes compare matching day numbers. Both values are shown under the change; hover for dates. A partial week is never compared with a full week. Conversion changes use percentage points (pp). Counts rising or costs falling improve; Spend stays neutral.</p><p>Week labels come from Raw Data’s Week Num, on Monday–Sunday periods. Missing or conflicting week labels, missing days, incomplete reports and incompatible Results contexts are not scored. An asterisk marks available but incomplete data; missing values are never zero. Shared outcomes are counted once at their proven scope.</p><p>Cost and conversion backgrounds use the dashboard’s operational thresholds; they do not set an ad action. CPB: safe ≤Rp300,000, warning ≤Rp400,000, review ≤Rp500,000, above Rp500,000 is red. No fixed targets are assumed for outcome counts, Spend or Leads → Booking. Center targets are not inferred from brand-wide monthly plans.</p></details></div>`;
}
function refreshCenterPeriods(focus){
  const host=$('centerPeriodsSlot');if(!host)return;
  host.innerHTML=renderCenterPeriods();
  if(focus)host.querySelector(focus)?.focus({preventScroll:true});
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-cp-grain],[data-cp-pair],[data-cp-page]');if(!b)return;
  if(b.dataset.cpGrain){centerPeriodGrain=b.dataset.cpGrain;centerPeriodOffset=0;refreshCenterPeriods(`[data-cp-grain="${centerPeriodGrain}"]`);}
  if(b.dataset.cpPair){centerPeriodPair=b.dataset.cpPair;centerPeriodSort='center';refreshCenterPeriods(`[data-cp-pair="${centerPeriodPair}"]`);}
  if(b.dataset.cpPage){centerPeriodOffset+=b.dataset.cpPage==='older'?1:-1;refreshCenterPeriods(`[data-cp-page="${b.dataset.cpPage}"]`);}
});
document.addEventListener('change',e=>{
  const id=e.target.id;
  if(id==='centerPeriodBasis')centerPeriodBasis=e.target.value;
  else if(id==='centerPeriodSort')centerPeriodSort=e.target.value;
  else if(id==='centerPeriodContext'){centerPeriodContext=e.target.value;centerPeriodOffset=0;}
  else return;
  refreshCenterPeriods('#'+id);
});

// Keep the same center visible in the paired scorecards on wide screens.
document.addEventListener('scroll',e=>{
  const panel=e.target;
  if(!panel.matches?.('#centerPeriodsSlot .cp-scroll'))return;
  const grid=panel.closest('.cp-grid');
  if(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length<2)return;
  for(const other of grid.querySelectorAll('.cp-scroll'))if(other!==panel){
    if(Math.abs(other.scrollTop-panel.scrollTop)>1)other.scrollTop=panel.scrollTop;
    if(Math.abs(other.scrollLeft-panel.scrollLeft)>1)other.scrollLeft=panel.scrollLeft;
  }
},true);
