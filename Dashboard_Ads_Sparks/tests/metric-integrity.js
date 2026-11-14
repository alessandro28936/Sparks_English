(() => {
  const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw new Error(name);};
  const close=(a,b)=>a===b||(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-7);
  const ratio=(a,b,m=1)=>b>0?a/b*m:null;
  const groups=A.group(rows,Rules.identity);
  const failures=[];
  for(const g of groups){
    const list=g.items,sum=k=>list.reduce((n,r)=>n+(Number.isFinite(r[k])?r[k]:0),0);
    const spend=sum('spend'),results=sum('results'),leads=sum('leads'),booking=sum('booking');
    const leadsReady=list.every(r=>Number.isFinite(r.leads)),bookingReady=list.every(r=>Number.isFinite(r.booking));
    const expected={spend,results,leads,booking,cpr:g.mixed?null:ratio(spend,results),cpl:leadsReady?ratio(spend,leads):null,cpb:bookingReady?ratio(spend,booking):null,leadRate:leadsReady&&!g.mixed?ratio(leads,results,100):null,bookingRate:leadsReady&&bookingReady?ratio(booking,leads,100):null,ctr:ratio(sum('clicks'),sum('impressions'),100)};
    for(const [k,v] of Object.entries(expected))if(!close(g[k],v))failures.push({ad:g.key,k,actual:g[k],expected:v});
    for(const k of ['cpl','cpb','leadRate','bookingRate'])if(!close(metricDisplayData(g,k).value,expected[k]))failures.push({ad:g.key,k,display:metricDisplayData(g,k).value,expected:expected[k]});
    const video=list.filter(r=>r.format==='Video'),vs=k=>video.reduce((n,r)=>n+r[k],0);
    if(!close(g.hook,ratio(vs('plays3'),vs('impressions'),100))||!close(g.view,ratio(vs('plays100'),vs('views'),100)))failures.push({ad:g.key,k:'video rates'});
  }
  check('All live ad aggregates and displayed ratios reconcile to source counts',failures.length===0);
  check('Incomplete rows never gain a numeric full-period conversion',groups.filter(g=>g.leadRows<g.rows).every(g=>metricDisplayData(g,'leadRate').value===null));
  const saved={from:$('startFilter').value,to:$('endFilter').value,view,scope,center:$('centerFilter').value,grain:explorerGrain,delivery:adsetDelivery};
  try{
    $('startFilter').value='2026-10-22';$('endFilter').value='2026-11-04';$('centerFilter').value='TCT';adsetDelivery='active';view='overview';render();
    const target=adsetDetails.find(g=>g.ad==='15/10/26 - VAFCU_89'&&g.adset==='TCT_T_D_W_BA_26/2/26');
    check('Screenshot target is identified by account, ad set and full ad name',!!target);
    check('Screenshot source metrics reconciled',target.results===44&&target.leads===3&&target.spend===968643);
    check('Screenshot misleading 100 percent and covered-spend CPL are suppressed',metricDisplayData(target,'leadRate').value===null&&metricDisplayData(target,'cpl').value===null);
    const html=metricScopeComparison(target);
    check('Both date windows are visible together',html.includes('2026-10-22')&&html.includes('2026-10-29')&&html.includes('Selected period')&&html.includes('7-day action metrics'));
    check('Partial outcome and missing ratio labels are visible',html.includes('Recorded')&&html.includes('Incomplete'));
    check('Matching explanation identifies ambiguous report keys',html.includes('3 source rows share this report key'));
    check('Selected-period totals stay separate from action totals',target.results===44&&target.operational.results===3);
    check('Action status expands to actual metrics and dates',actionStatus(target).includes('7-day action metrics')&&actionStatus(target).includes('2026-10-29'));
    check('Data methodology explains incomplete ratios',metricIntegrityMethodology().includes('Rasio dari sebagian hari tidak menggantikan'));
    const snapshot=meetingAdSource(target).snapshot;
    check('Bucket action snapshot retains operational window',snapshot.start==='2026-10-29'&&snapshot.selectedStart==='2026-10-22'&&snapshot.metrics.results===3);
  }finally{
    $('startFilter').value=saved.from;$('endFilter').value=saved.to;$('centerFilter').value=saved.center;view=saved.view;scope=saved.scope;explorerGrain=saved.grain;adsetDelivery=saved.delivery;render();
  }
  return {checks,adsAudited:groups.length,sourceRows:rows.length,failures};
})()
