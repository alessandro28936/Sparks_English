(() => {
  const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw new Error(name);};
  const L=PeriodLearning,sample=selected[0];
  const make=(day,spend,leads=1)=>({...sample,day,spend,leads,results:leads,booking:leads});
  const aggregate=items=>({...A.aggregate(items),items});
  const cost=aggregate([make('2026-10-01',100,1),make('2026-10-02',900,3)]);
  check('Average CPL uses sums, not mean of daily costs',L.daily(cost,'cpl')===250);
  check('Daily average counts divides by observed dates',L.daily(cost,'leads')===2);
  check('Lower cost improves performance',L.delta(80,100,'cpl').tone==='better');
  check('Higher cost worsens performance',L.delta(120,100,'cpb').tone==='worse');
  check('Higher results improves performance',L.delta(12,10,'results').tone==='better');
  check('Lower bookings worsens performance',L.delta(8,10,'booking').tone==='worse');
  check('Nine bookings over seven days vs nineteen is red',Math.abs(L.delta(9/7,19/7,'booking').pct+52.63157894736842)<1e-8&&L.delta(9/7,19/7,'booking').tone==='worse');
  check('Nine bookings over five days vs four is green',L.delta(9/5,4/5,'booking').pct===125&&L.delta(9/5,4/5,'booking').tone==='better');
  check('Spend stays neutral',L.delta(120,100,'spend').tone==='neutral');
  check('Zero reference has no invented percent',L.delta(10,0,'results').pct===undefined&&L.delta(10,0,'results').tone==='neutral');
  check('Null reference remains unavailable',L.delta(10,null,'results').tone==='neutral');
  check('Intensity is capped, actual percentage is not',L.delta(300,100,'results').strength===1&&L.delta(300,100,'results').pct===200);
  check('Daily comparison crosses year boundary',L.previousRange('2027-01-01','2027-01-01','daily').start==='2026-12-31');
  const weekly=L.previousRange('2026-10-28','2026-10-30','weekly');
  check('Partial week compares same weekdays',weekly.start==='2026-10-21'&&weekly.end==='2026-10-23');
  const full=L.previousRange('2026-03-01','2026-03-31','monthly');
  check('Full months retain full previous month',full.start==='2026-02-01'&&full.end==='2026-02-28'&&!full.currentEnd);
  const partial=L.previousRange('2028-03-15','2028-03-30','monthly');
  check('Partial month aligns valid days including leap year',partial.end==='2028-02-29'&&partial.currentEnd==='2028-03-29');
  check('No matching month date is unavailable',L.previousRange('2026-03-31','2026-03-31','monthly')===null);
  const current={...aggregate([make('2026-10-26',100),make('2026-10-27',100)]),start:'2026-10-26',end:'2026-10-31'};
  const history=[make('2026-10-19',100),make('2026-10-20',100)];
  const prior=L.comparison(current,history,'weekly',cost,'previous','2026-10-27');
  check('Latest data clips comparison without changing selected totals',prior.range.end==='2026-10-20'&&!prior.reason&&current.end==='2026-10-31');
  check('Missing prior date suppresses misleading change',!!L.comparison(current,history.slice(0,1),'weekly',cost,'previous','2026-10-27').reason);
  const incomplete=aggregate([make('2026-10-01',100,null)]);
  check('Missing Leads does not produce CPL or daily Leads',L.daily(incomplete,'cpl')===null&&L.daily(incomplete,'leads')===null);
  const saved={mode:periodCompareMode,open:periodValuesOpen,grain:chartGrain};
  try{
    reset();navigate('overview');
    const from=$('startFilter').value,to=$('endFilter').value,spend=A.aggregate(selected).spend;
    document.querySelector('.period-values').open=true;
    const select=$('periodComparison');select.value='average';select.dispatchEvent(new Event('change',{bubbles:true}));
    check('Changing comparison preserves date filters and totals',$('startFilter').value===from&&$('endFilter').value===to&&A.aggregate(selected).spend===spend);
    check('Average mode remains expanded and selected',document.querySelector('.period-values').open&&$('periodComparison').value==='average');
    const toggle=$('periodShowDetails');toggle.checked=true;toggle.dispatchEvent(new Event('change',{bubbles:true}));
    check('Comparison detail toggle works without changing totals',document.querySelector('.period-values').classList.contains('show-comparison-details')&&A.aggregate(selected).spend===spend);
    toggle.checked=false;toggle.dispatchEvent(new Event('change',{bubbles:true}));
    check('Average row includes all nine metrics',document.querySelectorAll('.period-average td.num').length===(overviewGroups(selected,'results').length>1?6+3*overviewGroups(selected,'results').length:9));
    check('One row per selected period',document.querySelectorAll('.period-primary .period-data').length===A.periodGroups(selected,chartGrain,from,to).length);
    const originalSearch=$('searchFilter').value;
    try{$('searchFilter').value='not-an-ad-qa';check('Previous history respects search filter',trendHistoryRows().length===0);}finally{$('searchFilter').value=originalSearch;}
    check('Comparison history can include dates before selected range',trendHistoryRows().some(r=>r.day<from));
    chartGrain='weekly';render();
    const first=overviewPeriods(selected,'weekly')[0];
    const bookingCell=document.querySelector('.period-data [data-period-metric=booking]'),known=first.items.filter(r=>Number.isFinite(r.booking)),knownDays=new Set(known.map(r=>r.day)).size,partial=first.bookingRows<first.rows;
    const expectedBooking=L.daily(first,'booking');
    check('Headline shows recorded daily bookings with coverage',bookingCell.querySelector('.period-main').firstChild.textContent===decimal(expectedBooking));
    check('Partial reports are labelled without performance color',!partial||(bookingCell.classList.contains('neutral')&&bookingCell.querySelector('[data-report-partial]')));
    check('Redundant totals are removed',!document.querySelector('.period-values .period-total')&&![...document.querySelectorAll('.period-values td.num')].some(td=>td.textContent.includes('Total')));
    for(const grain of ['weekly','monthly','daily']){
      const button=document.querySelector(`.period-grain-control [data-grain=${grain}]`);
      check(grain+' toggle is present directly above table',!!button);
      button.click();
      check(grain+' table toggle preserves dates and open state',chartGrain===grain&&document.querySelector('.period-values').open&&$('startFilter').value===from&&$('endFilter').value===to);
      check(grain+' table and chart controls stay synchronized',[...document.querySelectorAll('[data-grain-kind=chart].selected')].every(b=>b.dataset.grain===grain)&&document.querySelectorAll('.period-primary .period-data').length===A.periodGroups(selected,grain,from,to).length);
    }
    const glk=rows.filter(r=>r.center==='GLK'&&r.brand==='English'&&r.objective==='Traffic');
    const series=A.periodGroups(glk,'weekly','2026-10-01','2026-10-30'),agg=aggregate(glk.filter(r=>r.day>='2026-10-01'&&r.day<='2026-10-30'));
    const evidence=series.map(s=>{const c=L.comparison(s,glk,'weekly',agg,'previous','2026-10-30');return {start:s.start,end:s.end,booking:s.booking,days:s.days.size,reference:c.range,previousBooking:c.reference?.booking,previousDays:c.reference?.days.size,delta:L.delta(c.current?L.daily(c.current,'booking'):null,c.reference?L.daily(c.reference,'booking'):null,'booking',c.reason)};});
    checks.push({name:'GLK weekly comparison evidence',ok:true,evidence});
  }finally{periodCompareMode=saved.mode;periodValuesOpen=saved.open;chartGrain=saved.grain;render();}
  return checks;
})()
