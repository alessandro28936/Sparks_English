(()=>{
 const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
 for(const [value,tier] of [[null,'neutral'],[300000,'good'],[300001,'warning'],[400000,'warning'],[400001,'review'],[500000,'review'],[500001,'bad']])check('CPB boundary '+value,CostTargets.cpbTier(value)===tier);
 check('Old saved threshold cannot override CPB policy',CostTargets.limit('cpb',{cpbTarget:200000})===300000);
 const make=(spend,booking=1,extra={})=>A.normalize([{'Campaign name':'Traffic_WA_Main','Ad set name':'BHI_T_M_W','Ad name':'1/9/26 - V_QA','Ad Trim':'V_QA','Reporting starts':'2026-10-07','Ad delivery':'active','Amount spent (IDR)':spend,Results:20,Leads:20,Booking:booking,'Result type':'Messaging conversations started',...extra}])[0];
 const evalAd=(r,peers=[])=>Rules.evaluate({...A.aggregate([r]),...Object.fromEntries(['center','brand','account','campaign','adset','ad','objective','resultType'].map(k=>[k,r[k]])),items:[r],start:r.day,end:r.day},[],Rules.index([r,...peers]),{target:30000,minSpend:90000,minResults:5});
 check('300k is not a CPB warning',!['KILL','WATCH'].includes(evalAd(make(300000)).state));
 check('300001 is warning',evalAd(make(300001)).state==='WATCH');
 check('400k is warning',evalAd(make(400000)).state==='WATCH');
 check('400001 is review',evalAd(make(400001)).state==='CRITICAL');
 check('500k is review',evalAd(make(500000)).state==='CRITICAL');
 check('500001 is kill',evalAd(make(500001)).state==='KILL');
 check('Missing booking never triggers CPB kill',!evalAd(make(600000,null)).actionEvidence.killCodes.includes('K5'));
 check('Inactive never receives new CPB kill',evalAd(make(600000,1,{'Ad delivery':'inactive'})).state==='INACTIVE');
 check('No peer override for CPB kill',evalAd(make(600000),[make(900000,1,{'Ad name':'1/9/26 - V_PEER'})]).state==='KILL');
 const s=A.aggregate([make(350000)]);check('CPB warning stays visible with costly peers',priorityIssues(s,s.items||[make(350000)],[make(900000,5,{'Ad name':'1/9/26 - V_PEER'})]).some(x=>x.text.includes('CPB')));
 navigate('overview');
 check('Review first has no table',!document.querySelector('.priority-review table'));
 check('Initial review shows at most three alerts',document.querySelectorAll('.priority-alert').length<=3);
 for(const group of ['outcomes','costs','conversions','all']){
   document.querySelector('[data-period-group="'+group+'"]').click();
   const cols=[...document.querySelectorAll('.period-primary .period-data:first-of-type [data-period-metric]')].map(e=>e.dataset.periodMetric);
   check('Metric group updates '+group,periodMetricGroup===group);
   const headers=[...document.querySelectorAll('.period-primary thead th')].map(e=>e.textContent);
   check('Period group renders '+group,headers.length>1);
   if(group==='costs')check('Costs stay compact',headers.length<=4);
 }
 for(const grain of ['daily','weekly','monthly']){chartGrain=grain;periodMetricGroup='costs';render();check('Period renders '+grain,!!document.querySelector('.period-primary .period-data'));}
 chartGrain='weekly';periodMetricGroup='outcomes';render();
 check('Range average is distinct',!!document.querySelector('.period-average'));
 check('Details hidden initially',!document.querySelector('.period-primary.show-comparison-details'));
 return checks;
})()
