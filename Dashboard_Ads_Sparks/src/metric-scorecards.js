/* Weekday scorecards: never average cost ratios or invent missing daily reports. */
function scorecardAggregate(items){
  return items.every(r=>Number.isFinite(r.leads)&&Number.isFinite(r.booking))?A.aggregate(items):summaryAggregate(items);
}
const MetricScorecards=(()=>{
  const counts=new Set(['spend','results','leads','booking']);
  const rates=new Set(['leadRate','bookingRate']);
  const shift=(day,n)=>PeriodLearning.shift(day,n);
  const monday=day=>A.period(day,'weekly').start;
  const weekday=day=>(new Date(day+'T00:00:00Z').getUTCDay()+6)%7;
  function build(items,from,to,latest,aggregate=scorecardAggregate){
    if(!from||!to||from>to)return [];
    const end=latest&&latest<to?latest:to;
    if(end<from)return [];
    const byDay=new Map();
    for(const r of items)if(r.day>=from&&r.day<=end){if(!byDay.has(r.day))byDay.set(r.day,[]);byDay.get(r.day).push(r);}
    const weeks=[];
    for(let start=monday(from);start<=end;start=shift(start,7)){
      const cells=Array.from({length:7},(_,i)=>{
        const day=shift(start,i),included=day>=from&&day<=end,list=included?(byDay.get(day)||[]):[];
        return {day,included,items:list,s:aggregate(list)};
      });
      const own=cells.flatMap(c=>c.items),nums=new Set(own.map(r=>r.weekNum));
      const number=nums.size===1&&Number.isInteger([...nums][0])?[...nums][0]:null;
      weeks.push({start,end:shift(start,6),cells,items:own,s:aggregate(own),number,
        mappingIssue:number===null,partial:cells.some(c=>!c.included),
        first:cells.find(c=>c.included)?.day,last:cells.filter(c=>c.included).at(-1)?.day});
    }
    return weeks;
  }
  function read(s,key){
    if(!s?.rows)return {value:null,partial:false,reason:'No data'};
    if(contextSensitive(key)&&s.mixed)return {value:null,partial:false,reason:'Choose one Results context'};
    const r=overviewReading(s,key);
    return {...r,reason:r.partial?'Incomplete reports; see Data coverage':r.value===null?'No outcomes / zero denominator':''};
  }
  function change(current,previous,key,reason=''){
    const a=read(current,key),b=read(previous,key);
    if(reason||a.partial||b.partial||!Number.isFinite(a.value)||!Number.isFinite(b.value))return {text:'—',tone:'neutral',reason:reason||a.reason||b.reason};
    const diff=a.value-b.value,flat=Math.abs(diff)<1e-9;
    const tone=flat||key==='spend'?'neutral':(PeriodLearning.costKeys.includes(key)?diff<0:diff>0)?'better':'worse';
    if(rates.has(key))return {text:(flat?'0':(diff>0?'↑ ':'↓ ')+decimal(Math.abs(diff)))+' pp',tone,diff};
    if(b.value===0)return {text:flat?'0%':'↑ from 0',tone,diff};
    const pct=diff/b.value*100;
    return {text:flat?'0%':(pct>0?'↑ ':'↓ ')+percent(Math.abs(pct)),tone,pct};
  }
  function compare(weeks,key,day=null,aggregate=scorecardAggregate){
    const current=weeks.at(-1),previous=weeks.at(-2);
    if(!current||!previous||shift(current.start,-7)!==previous.start)return {text:'—',tone:'neutral',reason:'Previous week is outside this view'};
    const indexes=day===null?current.cells.flatMap((c,i)=>c.included?[i]:[]):[day];
    const a=indexes.map(i=>current.cells[i]),b=indexes.map(i=>previous.cells[i]);
    const reason=current.mappingIssue||previous.mappingIssue?'Week Num is missing or inconsistent':!a.length||[...a,...b].some(c=>!c.included||!c.items.length)?'Matching weekdays are unavailable in the selected range':'';
    const cur=aggregate(a.flatMap(c=>c.items)),ref=aggregate(b.flatMap(c=>c.items));
    return {...change(cur,ref,key,reason),current:read(cur,key).value,previous:read(ref,key).value,dates:a.map(c=>c.day),referenceDates:b.map(c=>c.day)};
  }
  function baseline(weeks,key,day=null,aggregate=scorecardAggregate){
    const indexes=day===null?weeks.at(-1)?.cells.flatMap((c,i)=>c.included?[i]:[])||[]:[day];
    const groups=weeks.map(w=>indexes.map(i=>w.cells[i])).filter(cells=>cells.length&&cells.every(c=>c.included&&c.items.length));
    const usable=groups.map(cs=>({items:cs.flatMap(c=>c.items),s:aggregate(cs.flatMap(c=>c.items))})).filter(g=>{const r=read(g.s,key);return !r.partial&&Number.isFinite(r.value);});
    if(!usable.length)return {value:null,n:0};
    return {value:counts.has(key)?usable.reduce((n,g)=>n+read(g.s,key).value,0)/usable.length:read(aggregate(usable.flatMap(g=>g.items)),key).value,n:usable.length};
  }
  function tone(s,key,settings=config){
    const r=read(s,key);if(r.partial||!Number.isFinite(r.value))return 'neutral';
    if(key==='cpb')return CostTargets.cpbTier(r.value);
    if(key==='leadRate')return r.value>=80?'good':'bad';
    const target=CostTargets.limit(key,settings);
    return target?(r.value<=target?'good':'bad'):'neutral';
  }
  return {build,read,change,compare,baseline,tone,counts,rates,weekday};
})();
const SCORECARD_METRICS=[['spend','Spend'],['results','Results'],['leads','Leads'],['cpr','CPR'],['cpl','CPL'],['booking','Booking'],['cpb','Cost per Booking'],['leadRate','Results → Leads'],['bookingRate','Leads → Booking']];
const SCORECARD_PAIRS={leads:{label:'Lead performance',keys:['leads','cpl']},booking:{label:'Booking performance',keys:['booking','cpb']},results:{label:'Result performance',keys:['results','cpr']},conversion:{label:'Conversion performance',keys:['leadRate','bookingRate']}};
let scorecardPair='leads',scorecardKeys=['leads','cpl'],scorecardOffset=0,scorecardContext='ALL',scorecardRangeKey='';
const scorecardDate=d=>new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const scorecardFormat=(v,k)=>k==='spend'||k.startsWith('cp')?money(v):MetricScorecards.rates.has(k)?percent(v):decimal(v);
function scorecardTarget(key){
  if(key==='cpb')return 'Safe ≤Rp300,000 · Warning ≤Rp400,000 · Review ≤Rp500,000';
  if(key==='leadRate')return 'Target ≥80%';
  const target=CostTargets.limit(key,config);return target?'Target ≤'+money(target):'No fixed target';
}
function scorecardCell(s,key,extra='',useTargets=true){
  const r=MetricScorecards.read(s,key),tone=useTargets?MetricScorecards.tone(s,key):'neutral';
  const status=r.value===null?r.reason:r.partial?r.reason:tone==='neutral'?'':tone==='good'?'Within target':tone==='warning'?'Warning':tone==='review'?'Review':'Above threshold / below target';
  return `<td class="num sc-cell sc-${tone}" data-sc-metric="${key}" title="${esc(extra+' '+status)}"><b>${scorecardFormat(r.value,key)}</b>${r.partial?'<sup aria-label="Incomplete reports">*</sup>':''}</td>`;
}
function scorecardTable(weeks,key,showTargets=true,useTargets=true){
  const name=SCORECARD_METRICS.find(m=>m[0]===key)[1],days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const current=weeks.at(-1),mask=current.cells.flatMap((c,i)=>c.included?[days[i]]:[]).join(', ');
  const delta=day=>{const d=MetricScorecards.compare(weeks,key,day);return `<td class="num sc-change ${d.tone}" title="${esc(d.reason||`${scorecardFormat(d.current,key)} vs ${scorecardFormat(d.previous,key)}; ${d.dates.join(', ')} vs ${d.referenceDates.join(', ')}`)}">${esc(d.text)}${day===null?`<small>${esc(mask)}</small>`:''}</td>`;};
  const baseline=day=>{const b=MetricScorecards.baseline(weeks,key,day);return `<td class="num sc-baseline" title="${b.n} comparable weeks; ${MetricScorecards.counts.has(key)?'arithmetic mean of counts':'ratio of pooled totals'}${day===null?'; same weekdays as latest column':''}"><b>${scorecardFormat(b.value,key)}</b>${day===null?`<small>${esc(mask)}</small>`:''}</td>`;};
  return `<section class="card sc-card" data-scorecard="${key}"><div class="sc-card-heading"><h2>${name}</h2><small>${useTargets?scorecardTarget(key):'Operational targets not evaluated'}</small></div><div class="sc-scroll" role="region" aria-label="${name} by weekday and week" tabindex="0"><table class="sc-table"><caption class="sc-sr">${name}. ${useTargets?'Cell colors show targets; ':''}WoW compares matching weekdays in the last two displayed weeks.</caption><thead><tr><th scope="col">Day</th>${weeks.map(w=>`<th scope="col" title="Week Num from Raw Data${w.mappingIssue?' is missing or inconsistent':''}">${w.number===null?'Week ?':'Week '+w.number}${w.partial?' <span class="sc-period-tag">'+(w.cells[0].included?'WTD':'Partial')+'</span>':''}<small>${esc(scorecardDate(w.first)+'–'+scorecardDate(w.last))}</small><small>${w.first.slice(0,4)}</small></th>`).join('')}<th scope="col">${weeks.length}W baseline</th><th scope="col">WoW Δ</th></tr></thead><tbody>${days.map((day,i)=>`<tr><th scope="row">${day}</th>${weeks.map(w=>scorecardCell(w.cells[i].s,key,w.cells[i].day+(w.cells[i].included?'':' · Outside selected / available dates'),useTargets)).join('')}${baseline(i)}${delta(i)}</tr>`).join('')}</tbody><tfoot><tr><th scope="row">${MetricScorecards.counts.has(key)?'Week total':'Week rate'}</th>${weeks.map(w=>scorecardCell(w.s,key,`${w.first}–${w.last}`,useTargets)).join('')}${baseline(null)}${delta(null)}</tr>${showTargets?scorecardTargetRows(weeks,key):''}</tfoot></table></div></section>`;
}
function renderScorecards(){
  const from=$('startFilter').value,to=$('endFilter').value,rangeKey=from+'|'+to;
  if(rangeKey!==scorecardRangeKey){scorecardOffset=0;scorecardRangeKey=rangeKey;}
  const contexts=A.group(selected,resultContext);
  if(scorecardContext!=='ALL'&&!contexts.some(g=>g.key===scorecardContext))scorecardContext='ALL';
  const items=scorecardContext==='ALL'?selected:selected.filter(r=>resultContext(r)===scorecardContext);
  const all=MetricScorecards.build(items,from,to,latestSourceDay());
  scorecardOffset=Math.min(scorecardOffset,Math.max(0,Math.ceil(all.length/4)-1));
  const end=all.length-scorecardOffset*4,start=Math.max(0,end-4),weeks=all.slice(start,end);
  const controls=`<section class="card sc-controls"><div class="sc-control-row"><div class="scope-switch sc-presets" role="group" aria-label="Metric pair">${Object.entries(SCORECARD_PAIRS).map(([id,p])=>`<button data-sc-pair="${id}" aria-pressed="${scorecardPair===id}" class="${scorecardPair===id?'selected':''}">${p.label}</button>`).join('')}<button data-sc-pair="custom" aria-pressed="${scorecardPair==='custom'}" class="${scorecardPair==='custom'?'selected':''}">Custom</button></div><div class="sc-actions"><button class="button secondary" data-sc-range>Last 4 weeks incl. WTD</button><button class="button primary sc-target-button" data-scorecard-targets aria-haspopup="dialog"><span aria-hidden="true">&#9881;</span> Targets</button></div></div>${scorecardPair==='custom'?`<div class="sc-custom">${scorecardKeys.map((k,i)=>`<label>Metric ${i+1}<select id="scorecardMetric${i}">${SCORECARD_METRICS.map(([v,l])=>`<option value="${v}" ${v===k?'selected':''} ${scorecardKeys[1-i]===v?'disabled':''}>${l}</option>`).join('')}</select></label>`).join('')}</div>`:''}${contexts.length>1?`<label class="sc-context">Results context<select id="scorecardContext"><option value="ALL">All contexts</option>${contexts.map(g=>`<option value="${esc(g.key)}" ${g.key===scorecardContext?'selected':''}>${esc(contextLabel(g.items[0]))}</option>`).join('')}</select></label><p class="sc-note">Choose one context to compare Results, CPR and Results → Leads.</p>`:''}</section>`;
  if(!items.length||!weeks.length)return controls+empty('No data for this selection','Choose another date range or adjust the filters.');
  const partial=weeks.flatMap(w=>w.cells).filter(c=>c.included&&c.s.rows&&(c.s.leadRows<c.s.rows||c.s.bookingRows<c.s.rows));
  return controls+`<div class="sc-toolbar"><p>Cell color: operational thresholds · WoW: <span class="period-good">Improved</span> / <span class="period-bad">Declined</span></p><div><button class="text-button" data-sc-page="older" ${start===0?'disabled':''} aria-label="Earlier weeks">←</button><span>${all.length>4?`Weeks ${start+1}–${end} of ${all.length} · `:''}${esc(scorecardDate(weeks[0].first))} – ${esc(scorecardDate(weeks.at(-1).last))}</span><button class="text-button" data-sc-page="newer" ${scorecardOffset===0?'disabled':''} aria-label="Later weeks">→</button></div></div><div class="sc-grid">${scorecardKeys.map(k=>scorecardTable(weeks,k)).join('')}</div>${partial.length?`<details class="sc-help"><summary>* Data coverage · ${partial.length} days</summary><p>Marked values use available reports only. They receive no target color or WoW score. A missing report is not zero.</p><div class="table-wrap"><table><thead><tr><th>Date</th><th>Leads rows</th><th>Booking rows</th></tr></thead><tbody>${partial.map(c=>`<tr><td>${c.day}</td><td>${c.s.leadRows} / ${c.s.rows}</td><td>${c.s.bookingRows} / ${c.s.rows}</td></tr>`).join('')}</tbody></table></div></details>`:''}${weeks.some(w=>w.mappingIssue)?'<p class="sc-note">Week ? means Week Num is missing or inconsistent. Those weeks are not scored for WoW.</p>':''}<details class="sc-help"><summary>How to read these scorecards</summary><p>Filters and the selected date range apply to every cell. Up to four weeks are shown at a time; arrows show earlier or later weeks. The shortcut explicitly selects three preceding weeks plus the current week through the latest source date. Weeks use Monday–Sunday columns with labels read from Week Num in Raw Data.</p><p>WoW compares the last displayed week with exactly seven days earlier, inside the selected range. Weekly change compares only matching weekdays: a Monday–Thursday WTD compares with Monday–Thursday, even when the previous column shows a full week. Hover a change for both dates and values. Missing days, incomplete reports and incompatible Results contexts are not scored. A rise from zero is shown without an infinite percentage.</p><p>Baseline uses available complete observations in the displayed weeks, including the latest week. Daily counts are averaged by weekday; cost and conversion baselines pool their underlying totals. The weekly baseline uses the same weekdays as the latest column; its included weekdays are shown below. CPR = Spend / Results, CPL = Spend / Leads, CPB = Spend / Booking. Results → Leads = Leads / Results; Leads → Booking = Booking / Leads. Ratios are recalculated, never averaged. Percentage changes in conversion use percentage points (pp).</p><p>Cell backgrounds show target compliance; WoW text shows improvement or decline. Costs falling or outcomes rising improve. Spend changes remain neutral. CPB above Rp500,000 is a threshold alert, not an automatic kill decision. Missing outcomes are not zero; shared reports are counted once at their proven scope. No fixed target is assumed for Spend, Results, Leads, Booking or Leads → Booking.</p></details>`;
}
function refreshScorecards(){ $('viewContent').innerHTML=renderScorecards(); }
function openScorecard(key){
  const pair=Object.keys(SCORECARD_PAIRS).find(p=>SCORECARD_PAIRS[p].keys.includes(key));
  scorecardPair=pair||'custom';scorecardKeys=pair?[...SCORECARD_PAIRS[pair].keys]:['spend','results'];scorecardOffset=0;
  navigate('scorecards');
}
document.addEventListener('click',e=>{
  const card=e.target.closest('[data-open-scorecard]');if(card&&!e.target.closest('summary,a')){openScorecard(card.dataset.openScorecard);return;}
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.scPair){scorecardPair=b.dataset.scPair;if(SCORECARD_PAIRS[scorecardPair])scorecardKeys=[...SCORECARD_PAIRS[scorecardPair].keys];refreshScorecards();document.querySelector(`[data-sc-pair="${scorecardPair}"]`)?.focus({preventScroll:true});}
  if(b.hasAttribute('data-sc-range')){const latest=latestSourceDay();if(latest){$('startFilter').value=PeriodLearning.shift(A.period(latest,'weekly').start,-21);$('endFilter').value=latest;datePreset='custom';rollingPeriod=false;scorecardOffset=0;render();}}
  if(b.dataset.scPage){scorecardOffset+=b.dataset.scPage==='older'?1:-1;refreshScorecards();}
});
document.addEventListener('keydown',e=>{const c=e.target.closest('[data-open-scorecard]');if(c&&e.target===c&&['Enter',' '].includes(e.key)){e.preventDefault();openScorecard(c.dataset.openScorecard);}});
document.addEventListener('change',e=>{
  if(/^scorecardMetric[01]$/.test(e.target.id)){const id=e.target.id;scorecardKeys[+id.slice(-1)]=e.target.value;refreshScorecards();$(id)?.focus({preventScroll:true});}
  if(e.target.id==='scorecardContext'){scorecardContext=e.target.value;refreshScorecards();$('scorecardContext')?.focus({preventScroll:true});}
});
