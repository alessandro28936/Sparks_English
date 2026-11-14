(async () => {
  explorerLayout='rows';
  const checks=[];
  const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw new Error(name);};
  check('Week starts Monday across year boundary',A.period('2027-01-01','weekly').start==='2026-12-28'&&A.period('2027-01-01','weekly').end==='2027-01-03');
  check('Sunday stays in preceding week',A.period('2026-11-01','weekly').start==='2026-10-26');
  check('Leap February includes 29 days',A.period('2028-02-10','monthly').end==='2028-02-29');
  const sample=selected[0];
  const fixture=[{...sample,day:'2026-10-01',spend:100,results:1,leads:1,booking:1},{...sample,day:'2026-10-03',spend:900,results:3,leads:9,booking:3}];
  const daily=A.periodGroups(fixture,'daily','2026-10-01','2026-10-03');
  check('Missing date is a gap instead of fabricated zero',daily.length===3&&daily[1].rows===0&&trendValue(daily[1],'results')===null);
  const monthly=A.periodGroups(fixture,'monthly','2026-10-01','2026-10-02');
  check('Monthly respects range and labels partial period',monthly.length===1&&monthly[0].spend===100&&monthly[0].end==='2026-10-02'&&monthly[0].partial);
  const weighted=A.periodGroups(fixture,'monthly','2026-10-01','2026-10-31')[0];
  check('Period cost ratios recalculate from totals',weighted.cpl===100&&weighted.cpr===250&&weighted.cpb===250);
  check('Full calendar month is not partial',!weighted.partial);
  reset();navigate('overview');
  const from=$('startFilter').value,to=$('endFilter').value,expected=A.aggregate(selected);
  for(const grain of ['daily','weekly','monthly']){
    document.querySelector(`[data-grain-kind="chart"][data-grain="${grain}"]`).click();
    check(`${grain} charts render all eight metrics`,document.querySelectorAll('.trend-card').length===8&&chartGrain===grain);
    check(`${grain} charts preserve date range`,$('startFilter').value===from&&$('endFilter').value===to);
    const s=A.periodGroups(selected,chartGrain,from,to);
    check(`${grain} chart totals reconcile`,s.reduce((n,p)=>n+p.spend,0)===expected.spend&&s.reduce((n,p)=>n+p.results,0)===expected.results);
  }
  chartGrain='daily';navigate('creatives');
  for(const grain of ['daily','weekly','monthly']){
    document.querySelector(`[data-grain-kind="explorer"][data-grain="${grain}"]`).click();
    check(`${grain} explorer preserves dates and adds period column`,$('startFilter').value===from&&$('endFilter').value===to&&document.querySelector('.period-cell'));
    check(`${grain} explorer totals reconcile`,periodCreatives.reduce((n,g)=>n+g.spend,0)===expected.spend&&periodCreatives.reduce((n,g)=>n+g.leads,0)===expected.leads);
    check(`${grain} bucket membership`,periodCreatives.every(g=>g.items.every(r=>r.day>=g.start&&r.day<=g.end)&&(grain!=='daily'||g.start===g.end)));
    const g=periodCreatives.find(g=>g.spend>0);
    const denom=rows.filter(r=>r.day>=g.start&&r.day<=g.end&&(grain!=='weekly'||A.sheetWeekKey(r)===g.weekKey)&&r.brand===g.brand&&r.campaign===g.campaign&&r.adset===g.adset).reduce((n,r)=>n+r.spend,0);
    check(`${grain} spend share uses bucket denominator`,Math.abs(g.share-g.spend/denom*100)<1e-8);
    check(`${grain} benchmark stays in bucket`,[...g.benchmark.days].every(day=>day>=g.start&&day<=g.end));
    showDetail(g.id);check(`${grain} opens corresponding period detail`,$('detailDialog').open&&$('detailContent').textContent.includes(periodText(g))&&brief(g).includes(g.start));$('detailDialog').close();
  }
  let blob;const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;
  try{URL.createObjectURL=b=>{blob=b;return create(b);};HTMLAnchorElement.prototype.click=()=>{};exportCsv();}
  finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click;}
  const csv=await blob.text();
  check('CSV exports period view and bounds',csv.includes('"View","Period start","Period end","Partial period"')&&csv.includes('"Monthly"')&&csv.split('\r\n').length===explorerList(false).length+1);
  document.querySelector('[data-grain-kind="explorer"][data-grain="summary"]').click();
  check('Original summary is preserved',!document.querySelector('.period-cell')&&explorerList(false).length===creatives.length);
  const savedRows=rows;
  try{
    const make=(day,weekNum,spend,ad='sheet-week-ad')=>({...sample,day,weekNum,spend,ad,adCode:ad,results:1,leads:1,booking:1});
    // Deliberately contradict calendar week boundaries and overlap dates.
    rows=[make('2026-10-01',41,100),make('2026-10-06',41,300),make('2026-10-06',42,900),make('2026-10-04',42,200,'peer-ad'),make('2026-10-07',null,50),make('2027-10-01',41,700)];
    $('startFilter').value='2026-10-01';$('endFilter').value='2027-10-31';explorerGrain='weekly';explorerWeek='ALL';navigate('creatives');
    const w41=periodCreatives.find(g=>g.weekNum===41&&g.weekYear==='2026'),w42=periodCreatives.find(g=>g.weekNum===42&&g.ad==='sheet-week-ad');
    check('AK week overrides calendar boundaries',w41.spend===400&&w41.days.size===2);
    check('Same date with different Week Num stays separate',w42.spend===900);
    check('Weekly denominator excludes other source week on same date',Math.abs(w42.share-900/1100*100)<1e-9);
    check('Weekly benchmark follows source week',w42.benchmark.spend===200&&w41.benchmark.rows===0);
    check('Repeated week numbers in different years stay separate',periodCreatives.some(g=>g.weekNum===41&&g.weekYear==='2027'&&g.spend===700));
    check('Blank AK has explicit group, no calendar fallback',periodCreatives.some(g=>g.weekNum===null&&g.spend===50)&&$('viewContent').textContent.includes('Week Num kosong / tidak valid'));
    document.querySelector('[data-week="2026|41"]').click();
    check('Week picker filters the ad performance table',explorerList(false).length===1&&explorerList(false)[0].spend===400);
    showDetail(w41.id);check('Detail shows source Week Num',$('detailContent').textContent.includes('Week 41')&&brief(w41).includes('Week 41'));$('detailDialog').close();
    let weeklyBlob;const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;
    try{URL.createObjectURL=b=>{weeklyBlob=b;return create(b);};HTMLAnchorElement.prototype.click=()=>{};exportCsv();}
    finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click;}
    const weekCsv=await weeklyBlob.text();check('Export respects Week picker and contains source number',weekCsv.includes('"Week Num","Week year"')&&weekCsv.includes('"41","2026"')&&weekCsv.split('\r\n').length===2);
    $('startFilter').value='2026-10-02';$('endFilter').value='2026-10-06';render();
    const clipped=explorerList(false)[0];check('Date range clips source week without pulling outside rows',clipped.spend===300&&clipped.partial&&clipped.weekNum===41);
    check('Source week parsing accepts numbers and text, rejects invalid',A.weekNumber('41')===41&&A.weekNumber(42)===42&&A.weekNumber('')===null&&A.weekNumber('#REF!')===null&&A.weekNumber(41.5)===null);
  }finally{rows=savedRows;explorerGrain='summary';explorerWeek='ALL';reset();}
  navigate('overview');
  return checks;
})()
