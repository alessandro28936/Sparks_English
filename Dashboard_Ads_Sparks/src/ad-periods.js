/* Detail trends compare displayed values with an explicitly visible earlier row. */
let detailPeriodGrain='daily',detailPeriodMode='totals',detailPeriodAd=null;
const AD_PERIOD_METRICS=[['spend','Spend',money],['share','Spend share',percent],['results','Results',integer],['leads','Leads',integer],['leadRate','Results → Leads',percent],['cpr','CPR',money],['cpl','CPL',money],['booking','Booking',integer],['cpb','CPB',money],['bookingRate','Leads → Booking (%)',percent]];
const AdPeriods=(()=>{
  const counts=new Set(['spend','results','leads','booking']),rates=new Set(['share','leadRate','bookingRate']);
  function build(g,visible,source,grain,from,to){
    const first=g.items[0],same=r=>A.adIdentity(r)===A.adIdentity(first)&&r.center===first.center&&A.sameMetricContext(r,first);
    const own=visible.filter(r=>same(r)&&r.day>=from&&r.day<=to);
    const setRows=source.filter(r=>adsetIdentity(r)===adsetIdentity(first)&&r.center===first.center);
    const aggregate=(items,start,end,weekKey=null)=>({...A.aggregate(items),items,start,end,share:A.ratio(items.reduce((n,r)=>n+r.spend,0),setRows.filter(r=>r.day>=start&&r.day<=end&&(!weekKey||A.sheetWeekKey(r)===weekKey)).reduce((n,r)=>n+r.spend,0),100)});
    let periods;
    if(grain==='weekly'){
      const weeks=A.sheetWeeks(source);
      periods=A.group(own,A.sheetWeekKey).map(group=>{
        const w=weeks.get(group.key),start=w.start<from?from:w.start,end=w.end>to?to:w.end;
        return {...aggregate(group.items,start,end,group.key),weekNum:w.weekNum,weekYear:w.weekYear,weekKey:group.key};
      });
    }else periods=A.periodGroups(own,'daily',from,to).map(p=>aggregate(p.items,p.start,p.end));
    const sorted=periods.sort((a,b)=>b.start.localeCompare(a.start));
    return sorted.map((p,i)=>{
      // Never import hidden days or skip an empty daily row to manufacture a comparison.
      const ref=sorted[i+1]||null;
      let reason=!ref?'No earlier row in this date range':!p.rows||!ref.rows?'No ad data in one of the displayed periods':p.days.size!==PeriodLearning.dayCount(p.start,p.end)||ref.days.size!==PeriodLearning.dayCount(ref.start,ref.end)?'Incomplete daily coverage':'';
      if(grain==='weekly'&&(p.weekNum===null||p.end>PeriodLearning.shift(p.start,6)||ref&&(ref.weekNum===null||ref.end>PeriodLearning.shift(ref.start,6)||ref.end>=p.start)))reason='Week mapping cannot be compared';
      const age=p.rows&&g.history?.published&&p.end>=g.history.published?PeriodLearning.dayCount(g.history.published,p.end):null;
      return {...p,age,combined:!!first.combinedNames,reference:ref,comparisonReason:reason};
    });
  }
  function reading(s,key,mode='totals'){
    if(!s)return {value:null,partial:false};
    const r=metricDisplayData(s,key);
    return {...r,value:r.value!==null&&mode==='average'&&counts.has(key)?(s.days.size?r.value/s.days.size:null):r.value};
  }
  function change(p,key,mode='totals'){
    const cur=reading(p,key,mode),ref=reading(p.reference,key,mode),reason=p.comparisonReason||((cur.partial||ref.partial)?'Incomplete outcome coverage':'');
    if(reason||!Number.isFinite(cur.value)||!Number.isFinite(ref.value))return {text:reason||'Unavailable value or zero denominator',tone:'neutral',strength:0};
    const diff=cur.value-ref.value,flat=Math.abs(diff)<1e-9,neutral=key==='spend'||key==='share';
    const tone=flat||neutral?'neutral':(PeriodLearning.costKeys.includes(key)?diff<0:diff>0)?'better':'worse';
    if(rates.has(key))return {text:'Percentage-point change',points:flat?0:diff,tone,strength:Math.min(Math.abs(diff),25)/25};
    if(ref.value===0)return {text:flat?'Unchanged':'From zero',zeroBaseline:true,pct:flat?0:undefined,tone,strength:flat?0:1};
    const pct=flat?0:diff/ref.value*100;
    return {text:'Relative change',pct,tone,strength:Math.min(Math.abs(pct),50)/50};
  }
  return {build,reading,change,counts};
})();
function renderAdPeriods(g){
  const from=$('startFilter').value||g.start,to=$('endFilter').value||g.end,weekly=detailPeriodGrain==='weekly',mode=weekly?detailPeriodMode:'totals',average=mode==='average';
  const periods=AdPeriods.build(g,selected,rows,detailPeriodGrain,from,to);
  const label=p=>weekly?(p.weekNum===null?'Week unknown':'Week '+p.weekNum):prettyDate(p.start);
  const formatValue=(v,key,format)=>average&&AdPeriods.counts.has(key)&&key!=='spend'?decimal(v):format(v);
  return `<section id="adPeriodPanel" class="ad-period-panel"><div class="ad-period-heading"><div><h3>Ad performance by period</h3><p>${esc(prettyDate(from))} – ${esc(prettyDate(to))}</p></div><div class="ad-period-options">${weekly?`<label class="ad-period-mode">Values<select id="adPeriodMode" aria-label="Weekly value basis"><option value="totals" ${!average?'selected':''}>Period totals</option><option value="average" ${average?'selected':''}>Daily averages</option></select></label>`:''}<div class="scope-switch" role="group" aria-label="Ad performance period"><button data-ad-period="daily" aria-pressed="${!weekly}" class="${!weekly?'selected':''}">Daily</button><button data-ad-period="weekly" aria-pressed="${weekly}" class="${weekly?'selected':''}">Weekly</button></div></div></div><p class="ad-period-caption">${average?'Daily averages':'Period totals'} · Compared with the earlier row shown below <span class="period-good">Improved</span> / <span class="period-bad">Declined</span>${weekly&&!average&&new Set(periods.map(p=>p.days.size)).size>1?'<span class="ad-period-duration-note">Different day counts · choose Daily averages to compare pace</span>':''}</p><div class="table-wrap ad-period-scroll" tabindex="0" role="region" aria-label="Scrollable ad performance metrics"><table><thead><tr><th>Period / comparison</th><th class="num">Ad age</th>${AD_PERIOD_METRICS.map(([key,text])=>`<th class="num" data-ad-period-header="${key}">${text}${average&&AdPeriods.counts.has(key)?'<small>per day</small>':''}</th>`).join('')}</tr></thead><tbody>${periods.length?periods.map(p=>`<tr data-ad-period-start="${esc(p.start)}"><td title="${esc(p.start+' – '+p.end)}"><b>${esc(label(p))}</b><small>${weekly?esc(prettyDate(p.start)+' – '+prettyDate(p.end))+' · '+p.days.size+' days':p.rows?'':'No data'}</small><small class="ad-period-reference">${p.reference?'vs '+esc(label(p.reference)):'No earlier row'}</small></td><td class="num">${p.combined?'Combined ads':p.age===null?'—':p.age+' days'}</td>${AD_PERIOD_METRICS.map(([key,text,format])=>{
    const reading=AdPeriods.reading(p,key,mode),ref=AdPeriods.reading(p.reference,key,mode),d=AdPeriods.change(p,key,mode);
    const style=d.tone==='neutral'?'':`background:rgba(${d.tone==='better'?'65,153,101':'202,83,75'},${.06+.16*d.strength})`;
    const difference=d.points??d.pct,delta=difference!==undefined?(difference===0?'0':`${difference>0?'↑':'↓'} ${decimal(Math.abs(difference))}`)+(d.points!==undefined?' pp':'%'):d.zeroBaseline?'↑ from 0':'—';
    const compared=p.reference?`${label(p.reference)} (${p.reference.start} – ${p.reference.end}): ${formatValue(ref.value,key,format)}. ${d.text}`:d.text;
    return `<td class="num ad-period-cell ${d.tone}" data-ad-period-metric="${key}" style="${style}" title="${esc(compared)}"><b>${key==='bookingRate'&&!reading.partial?bookingRateMarkup(reading.value,formatValue(reading.value,key,format)):formatValue(reading.value,key,format)}</b>${reading.partial?'<small class="report-state">'+(reading.value===null?'Incomplete report':'Recorded outcomes')+'</small>':''}<span class="period-delta">${delta}</span>${p.reference?`<small class="ad-period-reference">vs ${formatValue(ref.value,key,format)}${average&&AdPeriods.counts.has(key)?' / day':''}${ref.partial?' · incomplete':''}</small>`:''}</td>`;
  }).join('')}</tr>`).join(''):'<tr><td colspan="12">No ad data in the selected date range.</td></tr>'}</tbody></table></div><details class="ad-period-help"><summary>How to read this table</summary><p>Newest first. Each row compares only with the next earlier row displayed in this table; the oldest row has no comparison. No hidden dates outside the selected range are used. Weekly groups follow Week Num from Raw Data. Period totals compares the visible totals. Daily averages changes both the displayed Spend/Results/Leads/Booking and their comparisons to per-day values; costs and conversion ratios are unchanged. Different week lengths affect totals, so use Daily averages to compare pace.</p><p>Results/Leads/Booking rising is green; CPR/CPL/CPB falling is green. The reverse is red. Spend and spend share changes are neutral. Percentage metrics use percentage-point changes (pp); other metrics use relative percent change. A rise from zero is marked “from 0”, never an infinite percentage. Colors describe the change, not target compliance. Missing outcomes or daily coverage do not receive a trend score. All ratios are recalculated from the same period totals. Spend share uses all ads in the same center/account/campaign/ad set, regardless of search filters. Hover a cell for comparison dates and any reason a change is unavailable.</p></details>${reportMatchingPanel({...g,items:periods.flatMap(p=>p.items),rows:periods.reduce((n,p)=>n+p.rows,0)})}</section>`;
}
function refreshAdPeriodPanel(){
  const scroll=$('detailDialog').scrollTop;
  $('adPeriodPanel').outerHTML=renderAdPeriods(detailPeriodAd);
  $('detailDialog').scrollTop=scroll;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-ad-period]');if(!b||!detailPeriodAd||!['daily','weekly'].includes(b.dataset.adPeriod))return;
  detailPeriodGrain=b.dataset.adPeriod;refreshAdPeriodPanel();
  document.querySelector(`[data-ad-period="${detailPeriodGrain}"]`)?.focus({preventScroll:true});
});
document.addEventListener('change',e=>{
  if(e.target.id!=='adPeriodMode'||!detailPeriodAd||!['totals','average'].includes(e.target.value))return;
  detailPeriodMode=e.target.value;refreshAdPeriodPanel();$('adPeriodMode')?.focus({preventScroll:true});
});
