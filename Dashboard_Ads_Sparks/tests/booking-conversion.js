(async () => {
  const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw new Error(name);};
  const sample=selected[0],make=(leads,booking,day='2026-10-01')=>({...sample,day,leads,booking});
  const s=A.aggregate([make(2,1),make(98,9,'2026-10-02')]);
  check('Booking conversion uses Leads denominator and weighted totals',s.bookingRate===10);
  check('Zero Leads is unavailable',A.aggregate([make(0,2)]).bookingRate===null);
  check('Zero bookings with positive Leads is zero percent',A.aggregate([make(10,0)]).bookingRate===0);
  check('No rows is unavailable',A.aggregate([]).bookingRate===null);
  check('Missing Leads in one row suppresses whole ratio',A.aggregate([make(2,1),make(null,2)]).bookingRate===null);
  check('Missing Booking in one row suppresses whole ratio',A.aggregate([make(2,1),make(10,null)]).bookingRate===null);
  check('Rates above 100 percent are not silently clamped',A.aggregate([make(2,3)]).bookingRate===150);
  check('Period average never divides conversion by number of days',PeriodLearning.daily(s,'bookingRate')===10);
  check('Higher booking conversion is green',PeriodLearning.delta(20,10,'bookingRate').tone==='better');
  check('Lower booking conversion is red',PeriodLearning.delta(10,20,'bookingRate').tone==='worse');
  check('Snapshot captures new ratio',meetingMetrics(s).bookingRate===10);
  check('Old snapshot conversion derives from stored metrics only',meetingStoredRate({leads:20,booking:3})===15);
  check('Old incomplete snapshots remain unavailable',meetingStoredRate({leads:null,booking:3})===null&&meetingStoredRate({leads:0,booking:0})===null);
  check('Explicit unknown snapshot ratio is not reconstructed',meetingStoredRate({leads:20,booking:3,bookingRate:null})===null);
  navigate('overview');
  check('Overview has conversion chart and center chart',!!document.querySelector('.trend-card[data-metric=bookingRate]')&&!!document.querySelector('[data-center-metric=bookingRate]'));
  check('Period cell formats conversion as percent',document.querySelector('[data-period-metric=bookingRate] .period-main').textContent.includes('%')||document.querySelector('[data-period-metric=bookingRate] .period-main').textContent===percent(null));
  for(const grain of ['daily','weekly','monthly']){
    const values=A.periodGroups([make(2,1),make(98,9,'2026-10-02')],grain,'2026-10-01','2026-10-02');
    check(grain+' conversion recalculates from totals',values.every(g=>g.bookingRate===g.booking/g.leads*100));
  }
  navigate('centers');check('Center card conversion is formatted as percent',document.querySelector('.center-card .meeting-metrics').textContent.includes('Leads → Booking (%)'));
  explorerGrain='summary';navigate('creatives');check('Explorer main table includes conversion',document.querySelector('thead').textContent.includes('Leads → Booking (%)'));
  explorerGrain='weekly';explorerLayout='compare';render();check('Weekly comparison contains conversion group',!!document.querySelector('.metric-group[data-metric=bookingRate]'));
  let blob;const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;
  try{URL.createObjectURL=b=>{blob=b;return create(b);};HTMLAnchorElement.prototype.click=()=>{};exportCsv();}finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click;}
  check('CSV export includes conversion', (await blob.text()).includes('"Leads to Booking %"'));
  explorerGrain='summary';meetingTab='learning';navigate('meeting');check('Pillar learning includes conversion when mapped',!meetingLearningGroups().length||$('viewContent').textContent.includes('Leads → Booking (%)'));
  reset();navigate('overview');return checks;
})()
