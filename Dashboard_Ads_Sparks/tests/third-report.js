(async () => {
  const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name+(name.includes('source Daily Report')?' '+JSON.stringify({sample:source.slice(0,2),mismatches:matched.filter(r=>{const e=expected.get(r.day+'|'+r.adCode);return !e||e.leads!==r.leads||e.booking!==r.booking;}).slice(0,8).map(r=>({day:r.day,ad:r.ad,leads:r.leads,booking:r.booking,expected:expected.get(r.day+'|'+r.adCode)}))}):''));};
  const target=rows.filter(r=>r.account==='Third'&&r.adset===MY_THIRD_ADSET);
  check('Managed Third ad set is present',target.length>0);
  check('Third center resolves to CL.JU',target.every(r=>r.center==='CL.JU'));
  const nov8=target.find(r=>r.day==='2026-11-08'&&r.adCode==='VEXTR_30');
  const nov9=target.find(r=>r.day==='2026-11-09'&&r.adCode==='VEXTR_30');
  check('November 8 VEXTR_30 has 6 Leads and 2 Booking',nov8?.leads===6&&nov8?.booking===2);
  check('Confirmed typo merged November 9 to 9 Leads and 2 Booking',nov9?.leads===9&&nov9?.booking===2);
  const s=A.aggregate([nov9]);
  check('CPL divides the same row spend by 9 Leads',s.cpl===nov9.spend/9);
  check('CPB divides the same row spend by 2 Booking',s.cpb===nov9.spend/2);
  check('Results to Leads uses the same row Results',s.leadRate===9/nov9.results*100);
  check('Booking conversion equals 2 divided by 9',s.bookingRate===2/9*100);
  const matched=target.filter(r=>Number.isFinite(r.leads)&&Number.isFinite(r.booking));
  check('Every matched Third row has an account-specific report bucket',matched.every(r=>reportSummaryIndex.buckets.some(b=>b.tier==='account'&&b.members.includes(r)&&b.leads===r.leads&&b.booking===r.booking)));
  check('TA reports never enter the legacy bucket',reportSummaryIndex.buckets.every(b=>b.tier!=='legacy'||!b.key.includes('_TA|')));
  check('Third report buckets never match Main or Secondary',reportSummaryIndex.buckets.filter(b=>b.tier==='account'&&b.key.endsWith('|Third')).every(b=>b.members.every(r=>r.account==='Third')));
  const source=await jsonp('Copy of Daily Report',"select A,C,D,L,O where (C = 'CL.JU_T_D_W_TA' or C = 'JU_T_D_W_TA' or C = 'ALLS-ENG-JU_T_D_W_TA') and A >= date '2026-11-01'",'A1:AE89762');
  const expected=new Map();
  for(const r of source){const key=A.date(r.calendar_date)+'|'+r.ad_name,v=expected.get(key)||{leads:0,booking:0};v.leads+=A.num(r.Leads)||0;v.booking+=A.num(r['Bookings by Booking Date'])||0;expected.set(key,v);}
  check('Matched ads reconcile exactly to source Daily Report',matched.every(r=>{const e=expected.get(r.day+'|'+r.adCode);return e&&e.leads===r.leads&&e.booking===r.booking;}));
  check('Original source count preserved when summarizing',summaryAggregate(target).spend===A.aggregate(target).spend);
  return {checks,rows:target.length,matched:matched.length,unresolved:target.filter(r=>!Number.isFinite(r.leads)).map(r=>({day:r.day,ad:r.ad,reason:r.reportIssue})),nov9:{spend:nov9.spend,results:nov9.results,leads:nov9.leads,booking:nov9.booking,cpl:s.cpl,cpb:s.cpb,leadRate:s.leadRate,bookingRate:s.bookingRate}};
})()
