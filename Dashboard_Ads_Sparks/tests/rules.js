(() => {
 const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw new Error(name);};
 const cfg={target:30000,minSpend:90000,minResults:5};
 const make=(x={})=>A.normalize([{'Campaign name':'Traffic_WA_Main','Ad set name':'BHI_T_M_W','Ad name':'1/9/26 - V_TEST','Ad Trim':'V_TEST','Reporting starts':'2026-10-07','Ad delivery':'active','Amount spent (IDR)':100000,'Results':10,'Leads':10,'Booking':1,'Impressions':1000,'Link clicks':20,'Views':1000,'3-second video plays':300,'Video plays at 100%':400,'Frequency':1.2,'Result type':'Messaging conversations started',...x}])[0];
 const run=(items,peers=[],extra={},scope='ALL')=>{const r=items[0],s={...A.aggregate(items),...Object.fromEntries(['center','brand','account','campaign','adset','ad','objective','resultType'].map(k=>[k,r[k]])),items,start:'2026-10-01',end:'2026-10-07',...extra};return Rules.evaluate(s,[],Rules.index([...items,...peers]),cfg);};
 const ev=(x={},peers=[])=>run([make(x)],peers),codes=g=>g.actionEvidence.killCodes;
 const has=(g,k)=>codes(g).includes(k);
 const conflict=run([make({'Ad name':'6/10/26 - V_TEST','Reporting starts':'2026-10-04'}),make({'Ad name':'6/10/26 - V_TEST','Reporting starts':'2026-10-07'})]);
 check('Earlier paid delivery invalidates the publish-date prefix',conflict.history.publishConflict&&conflict.history.ageDays===null);
 check('Conflicting publish dates do not truncate action evidence',conflict.operational.spend===200000&&conflict.operational.results===20);
 check('Publish conflict is explained in the ad diagnosis',conflict.diagnosis.reasons.some(r=>r.includes('penayangan pertama')));
 check('K1 below 60',has(ev({Leads:5,Booking:0}),'K1'));
 check('K1 at 60 excluded',!has(ev({Leads:6,Booking:0}),'K1'));
 check('All kill wait for spend',ev({Leads:0,Booking:0,'Amount spent (IDR)':89999}).state==='SAMPLE');
 check('Spend boundary allowed',has(ev({Leads:0,Booking:0,'Amount spent (IDR)':90000}),'K1'));
 check('Ratios need five Results',!has(ev({Results:4,Leads:0,Booking:0}),'K1'));
 check('Missing Leads not zero',ev({Leads:null,Booking:0}).state==='MIXED');
 check('Missing Booking blocks K1',ev({Leads:0,Booking:null}).state==='MIXED');
 const bp=make({'Ad name':'1/9/26 - V_PEER','Amount spent (IDR)':200000,Booking:1});
 const protectedAd=ev({Leads:5,Booking:1},[bp]);
 check('Good CPB protects K1',protectedAd.state==='CRITICAL'&&protectedAd.actionEvidence.protectedBooking&&!has(protectedAd,'K1'));
 check('Existing Booking without CPB benchmark gets review',ev({Leads:5}).state==='CRITICAL');
 const zero=Array.from({length:4},(_,i)=>make({'Reporting starts':'2026-10-0'+(4+i),Results:0,Leads:0,Booking:0,'Amount spent (IDR)':25000}));
 check('Four real zero days trigger K2',has(run(zero),'K2'));
 check('Missing calendar day prevents K2',!has(run(zero.slice(1)),'K2'));
 check('Results in last four prevent K2',!has(run([...zero.slice(0,3),make({Results:1,Leads:0,Booking:0,'Amount spent (IDR)':25000})]),'K2'));
 check('K2 also waits spend',run(zero.map(r=>({...r,spend:20000}))).state==='SAMPLE');
 check('Zero share cannot bypass spend',ev({Results:0,Leads:0,Booking:0,'Amount spent (IDR)':1}).state==='SAMPLE');
 const monthly=make({'Ad name':'1/9/26 - V_PEER','Reporting starts':'2026-09-15','Amount spent (IDR)':100000,Results:10});
 check('K3 uses previous month',has(ev({Results:4,Leads:0,Booking:0},[monthly]),'K3'));
 check('No monthly benchmark is review',ev({Results:1,Leads:0,Booking:0}).state==='CRITICAL');
 const expensive={...monthly,spend:125000};
 check('Exactly twice monthly CPR is not K3',!has(ev({Results:4,Leads:0,Booking:0},[expensive]),'K3'));
 check('Own previous month excluded',!ev({Results:1,Leads:0,Booking:0},[{...monthly,ad:make().ad}]).actionEvidence.monthly.ready);
 check('Other brand excluded',!ev({Results:1,Leads:0,Booking:0},[{...monthly,brand:'SLSA'}]).actionEvidence.monthly.ready);
 check('Other Results type excluded',!ev({Results:1,Leads:0,Booking:0},[{...monthly,resultType:'Other'}]).actionEvidence.monthly.ready);
 check('K4 age seven',has(ev({'Ad name':'1/10/26 - V_TEST',Leads:6,Booking:0}),'K4'));
 check('K4 age six excluded',!has(ev({'Ad name':'2/10/26 - V_TEST',Leads:6,Booking:0}),'K4'));
 check('K4 70 percent excluded',!has(ev({Leads:7,Booking:0}),'K4'));
 check('K4 Booking positive excluded',!has(ev({Leads:6,Booking:1}),'K4'));
 check('K5 CPB above million',has(ev({Leads:7,Booking:1,'Amount spent (IDR)':1000001}),'K5'));
 check('K5 exactly 500k excluded',!has(ev({Leads:7,Booking:1,'Amount spent (IDR)':500000}),'K5'));
 check('K5 applies even with good lead conversion',has(ev({Leads:8,Booking:1,'Amount spent (IDR)':1000001}),'K5'));
 check('K5 healthy CPR/CPL/lead rate is review, not kill',(()=>{
   const g=ev({Results:23,Leads:47,Booking:1,'Amount spent (IDR)':673987});
   return g.state==='CRITICAL'&&g.actionEvidence.k5Review&&g.actionEvidence.k5HealthyFunnel&&!has(g,'K5')&&g.diagnosis.reasons.some(r=>r.includes('K5:')&&r.includes('Prioritas review'));
 })());
 check('K5 red CPB remains red in review',CostTargets.cpbTier(ev({Results:23,Leads:47,Booking:1,'Amount spent (IDR)':673987}).operational.cpb)==='bad');
 check('K5 fails protection when CPR red',has(ev({Results:20,Leads:47,Booking:1,'Amount spent (IDR)':673987}),'K5'));
 check('K5 fails protection when CPL red',has(ev({Results:23,Leads:12,Booking:1,'Amount spent (IDR)':673987}),'K5'));
 check('K5 fails protection when lead rate red',has(ev({Results:30,Leads:23,Booking:1,'Amount spent (IDR)':673987}),'K5'));
 check('K5 incomplete Leads never gets green protection',has(ev({Results:23,Leads:null,Booking:1,'Amount spent (IDR)':673987}),'K5'));
 check('K5 protected review is not a blanket exception to other kills',(()=>{
   const items=Array.from({length:4},(_,i)=>make({'Reporting starts':'2026-10-0'+(4+i),Results:0,Leads:0,Booking:0,'Amount spent (IDR)':20000}));
   // Add valid Results on an earlier day outside K2's four-calendar-day window.
   const past=make({'Reporting starts':'2026-10-01',Results:23,Leads:47,Booking:1,'Amount spent (IDR)':593987});
   const g=run([past,...items]);
   return has(g,'K2')&&g.state==='KILL'&&g.actionEvidence.k5Review;
 })());
 check('TCT 13/10 VAFBE_33 is review on verified 9-15 Nov 7-day sample',(()=>{
   const samples=[
     ['2026-11-09',174671,13,22,0],['2026-11-10',64809,0,5,0],['2026-11-11',51921,4,5,1],
     ['2026-11-12',60273,2,6,0],['2026-11-13',49634,3,6,0],['2026-11-14',202247,1,2,0],['2026-11-15',70432,0,1,0]
   ];
   const items=samples.map(([day,spend,results,leads,booking])=>make({
     'Ad name':'13/10/26 - VAFBE_33','Ad set name':'TCT_T_D_W_BA_26/2/26','Account Group':'Secondary','Reporting starts':day,
     'Amount spent (IDR)':spend,Results:results,Leads:leads,Booking:booking
   }));
   const g=run(items,[],{start:'2026-11-09',end:'2026-11-15'});
   return g.state==='CRITICAL'&&g.actionEvidence.k5Review&&!has(g,'K5')&&g.operational.cpb===673987&&g.operational.results===23&&g.operational.leads===47;
 })());
 check('K5 does not require age above twelve',has(ev({'Ad name':'26/9/26 - V_TEST',Leads:7,Booking:1,'Amount spent (IDR)':1000001}),'K5'));
 check('K5 age thirteen allowed',has(ev({'Ad name':'25/9/26 - V_TEST',Leads:7,Booking:1,'Amount spent (IDR)':1000001}),'K5'));
 check('K5 zero Booking not infinite CPB',!has(ev({Leads:7,Booking:0,'Amount spent (IDR)':1000001}),'K5'));
 check('Inactive no kill',ev({Leads:0,Booking:0,'Ad delivery':'inactive'}).state==='INACTIVE');
 check('Unknown status no kill',ev({Leads:0,Booking:0,'Ad delivery':''}).state==='MIXED');
 const weakAdditional=ev({'Link clicks':1,'3-second video plays':1,'Video plays at 100%':1,Frequency:5},[bp]);
 check('Additional metrics never kill',weakAdditional.state==='ITERATE'&&weakAdditional.creativeEvaluation&&codes(weakAdditional).length===0);
 check('Additional flags record four warnings',weakAdditional.ruleWarnings.length===4);
 check('Healthy lone ad qualifies by target without peers',ev().state==='ITERATE');
 check('Small share winner prioritizes delivery',ev({},[{...bp,spend:20000000}]).state==='OPPORTUNITY');
 check('No old-date good result masks kill',has(run([make({'Reporting starts':'2026-09-25',Results:1000,Leads:1000,Booking:100}),make({Leads:5,Booking:0})]),'K1'));
 check('Selected start does not truncate action window',run([make({'Reporting starts':'2026-10-02'}),make()],[],{start:'2026-10-07'}).operational.results===20);
 check('Future data not included',run([make(),make({'Reporting starts':'2026-10-10',Results:100})]).operational.results===10);
 check('Current month not monthly benchmark',!ev({Results:1,Leads:0,Booking:0},[bp]).actionEvidence.monthly.ready);
 check('Calendar month boundary',Rules.previousMonth('2026-01-03').start==='2025-12-01');
 check('Publish parser DMY',Rules.published('9/9/26 - TEST')==='2026-09-09');
 check('Invalid publish rejected',Rules.published('31/2/26 - TEST')===null);
 check('Conflicting status not guessed',run([make(),make({'Ad delivery':'inactive'})]).state==='MIXED');
 check('Table totals preserved',run([make({'Reporting starts':'2026-09-25',Results:1000}),make()]).results===1010);
 check('Operational totals separate',run([make({'Reporting starts':'2026-09-25',Results:1000}),make()]).operational.results===10);
 check('Evidence version recorded',ev().actionEvidence.version==='main-metrics-v7-k5-healthy-funnel');
 check('Live candidates never kill',candidates().every(g=>['ITERATE','OPPORTUNITY'].includes(g.state)&&!g.killReasons.length));
 return checks;
})()
