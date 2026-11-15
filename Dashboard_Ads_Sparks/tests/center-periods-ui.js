(()=>{
  const checks=[],ok=(name,value)=>{checks.push({name,ok:!!value});if(!value)throw Error(name);};
  const from=$('startFilter').value,to=$('endFilter').value;
  const filters=()=>['centerFilter','accountFilter','brandFilter','campaignFilter','objectiveFilter','resultFilter','roleFilter','messageFilter','searchFilter','startFilter','endFilter'].map(id=>$(id).value).join('|');
  const before=filters();
  ok('Table appears first in Center Insights',$('viewContent').firstElementChild.id==='centerPeriodsSlot');
  ok('Weekly is initial view',centerPeriodGrain==='weekly');
  ok('Paired tables are present',document.querySelectorAll('.cp-metric-card').length===2);
  const order=()=>[...document.querySelectorAll('.cp-table')].map(t=>[...t.querySelectorAll('tbody th')].map(c=>c.textContent).join('|'));
  ok('Both tables preserve same center order',order()[0]===order()[1]);
  const scrolls=[...document.querySelectorAll('.cp-scroll')];
  scrolls.forEach(s=>s.style.maxHeight='320px');
  scrolls[0].scrollTop=64;scrolls[0].dispatchEvent(new Event('scroll'));
  ok('Paired center rows scroll together on wide screens',scrolls[1].scrollTop===64);
  scrolls.forEach(s=>{s.style.maxHeight='';s.scrollTop=0;});
  const m=CenterPeriods.build(selected,{from,to,latest:latestSourceDay(),grain:'weekly'});
  let cells=0,independent=0;
  for(const g of m.groups)for(const cell of g.cells){
    const original=selected.filter(r=>r.center===g.center&&r.brand===g.brand&&r.day>=cell.period.start&&r.day<=cell.period.end),direct=summaryAggregate(original);
    for(const k of ['spend','results','leads','booking','cpr','cpl','cpb','leadRate','bookingRate']){
      const a=overviewReading(cell.s,k).value,b=overviewReading(direct,k).value;
      if(a!==b&&!(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-7))throw Error('Reconciliation failed '+g.center+' '+cell.period.start+' '+k);
    }
    if(original.length&&original.every(r=>Number.isFinite(r.leads)&&Number.isFinite(r.booking))){
      const sums=Object.fromEntries(['spend','results','leads','booking'].map(k=>[k,original.reduce((n,r)=>n+r[k],0)]));
      const divide=(n,d,m=1)=>d>0?n/d*m:null;
      const expected={...sums,cpl:divide(sums.spend,sums.leads),cpb:divide(sums.spend,sums.booking),bookingRate:divide(sums.booking,sums.leads,100)};
      if(!cell.s.mixed)Object.assign(expected,{cpr:divide(sums.spend,sums.results),leadRate:divide(sums.leads,sums.results,100)});
      for(const [k,value] of Object.entries(expected))if(cell.s[k]!==value&&!(Number.isFinite(value)&&Math.abs(cell.s[k]-value)<1e-7))throw Error('Independent calculation failed '+g.center+' '+k);
      independent++;
    }
    cells++;
  }
  ok('Live center-period metrics reconcile with existing summary',cells>0);
  ok('Live complete cells agree with independent sums and ratios',independent>0);
  const expectedNumbers=m.periods.slice(-4).map(p=>p.number===null?'Week ?':'Week '+p.number);
  const headings=[...document.querySelector('.cp-table').querySelectorAll('thead th')].slice(1,-1);
  ok('Weekly labels and date details rendered',headings.every((th,i)=>th.textContent.includes(expectedNumbers[i])&&th.querySelector('small')));
  document.querySelector('[data-cp-pair="booking"]').click();
  ok('Booking and CPB pair works',document.querySelector('[data-cp-metric="booking"]')&&document.querySelector('[data-cp-metric="cpb"]'));
  $('centerPeriodSort').value='cpb:desc';$('centerPeriodSort').dispatchEvent(new Event('change',{bubbles:true}));
  ok('Sorting synchronized across tables',centerPeriodSort==='cpb:desc'&&order()[0]===order()[1]);
  $('centerPeriodBasis').value='daily';$('centerPeriodBasis').dispatchEvent(new Event('change',{bubbles:true}));
  ok('Daily average mode changes count heading',document.querySelector('[data-cp-metric="booking"] .cp-metric-heading').textContent.includes('Daily average'));
  ok('CPB keeps ratio basis',document.querySelector('[data-cp-metric="cpb"] .cp-metric-heading').textContent.includes('Ratio of totals'));
  document.querySelector('[data-cp-grain="daily"]').click();
  ok('Daily view works without changing global range',centerPeriodGrain==='daily'&&$('startFilter').value===from&&$('endFilter').value===to);
  const currentHeader=document.querySelector('.cp-table thead').textContent;
  document.querySelector('[data-cp-page="older"]').click();
  ok('Earlier periods accessible',centerPeriodOffset===1&&document.querySelector('.cp-table thead').textContent!==currentHeader);
  document.querySelector('[data-cp-page="newer"]').click();
  ok('Later periods accessible',centerPeriodOffset===0&&document.querySelector('.cp-table thead').textContent===currentHeader);
  document.querySelector('[data-cp-grain="monthly"]').click();
  ok('Monthly view has months',document.querySelector('.cp-table thead').textContent.includes('October')&&document.querySelector('.cp-table thead').textContent.includes('November'));
  document.querySelector('[data-cp-pair="conversions"]').click();
  ok('Both conversion metrics accessible',document.querySelector('[data-cp-metric="leadRate"]')&&document.querySelector('[data-cp-metric="bookingRate"]'));
  document.querySelector('[data-cp-pair="results"]').click();
  ok('Results and CPR accessible',document.querySelector('[data-cp-metric="results"]')&&document.querySelector('[data-cp-metric="cpr"]'));
  document.querySelector('[data-cp-pair="spend"]').click();
  ok('Spend uses one table',document.querySelectorAll('.cp-metric-card').length===1&&document.querySelector('[data-cp-metric="spend"]'));
  ok('No controls mutate global filters',filters()===before);
  ok('Keyboard-focusable table scrolling',document.querySelector('.cp-scroll').getAttribute('tabindex')==='0');
  centerPeriodBasis='total';
  return {passed:checks.length,reconciledCells:cells,independentCells:independent,checks};
})()
