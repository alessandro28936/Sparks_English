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
 check('K5 does not require age above twelve',has(ev({'Ad name':'26/9/26 - V_TEST',Leads:7,Booking:1,'Amount spent (IDR)':1000001}),'K5'));
 check('K5 age thirteen allowed',has(ev({'Ad name':'25/9/26 - V_TEST',Leads:7,Booking:1,'Amount spent (IDR)':1000001}),'K5'));
 check('K5 zero Booking not infinite CPB',!has(ev({Leads:7,Booking:0,'Amount spent (IDR)':1000001}),'K5'));
 // CPB >500k is review, never K5 kill, only when CPR, CPL and Results-to-Leads are ALL green on the same 7 days.
 const healthyK5=ev({Results:20,Leads:17,Booking:1,'Amount spent (IDR)':510000});
 check('K5 green funnel downgrades to review',healthyK5.state==='CRITICAL'&&!has(healthyK5,'K5')&&healthyK5.actionEvidence.k5ReviewProtected);
 check('K5 review retains red CPB and green CPR/CPL/Results-to-Leads',healthyK5.operational.cpb>500000&&CostTargets.cpbTier(healthyK5.operational.cpb)==='bad'&&healthyK5.operational.cpr<=cfg.target&&healthyK5.operational.cpl<=CostTargets.limit('cpl',cfg)&&healthyK5.operational.leadRate>=80);
 check('K5 review gives explicit actionable explanation',healthyK5.diagnosis.reasons.some(r=>r.includes('K5:')&&r.includes('prioritas review')));
 const badCprK5=ev({Results:10,Leads:9,Booking:1,'Amount spent (IDR)':510000});
 check('K5 still kills when CPR and CPL are not green',badCprK5.state==='KILL'&&has(badCprK5,'K5'));
 const badRateK5=ev({Results:24,Leads:14,Booking:1,'Amount spent (IDR)':510000});
 check('K5 still kills when Results-to-Leads is red',has(badRateK5,'K5'));
 const missingLeadK5=ev({Results:20,Leads:null,Booking:1,'Amount spent (IDR)':510000});
 check('Missing Leads do not qualify for K5 green exception',has(missingLeadK5,'K5')&&!missingLeadK5.actionEvidence.k5ReviewProtected);
 const lowSampleK5=ev({Results:4,Leads:4,Booking:1,'Amount spent (IDR)':510000});
 check('Fewer than minimum Results cannot qualify for K5 green exception',has(lowSampleK5,'K5'));
 // Real TCT 13/10/26 - VAFBE_33, Secondary, 9-15 November 2026; raw daily figures verified against Centers.
 const tctDays=[
  ['2026-11-09',174671,13,22,0],['2026-11-10',64809,0,5,0],
  ['2026-11-11',51921,4,5,1],['2026-11-12',60273,2,6,0],
  ['2026-11-13',49634,3,6,0],['2026-11-14',202247,1,2,0],['2026-11-15',70432,0,1,0]
 ];
 const tctRows=tctDays.map(([day,spend,results,leads,booking])=>make({
  'Campaign name':'Traffic_WA_Diversified_BA_14/2/26','Ad set name':'TCT_T_D_W_BA_26/2/26',
  'Ad name':'13/10/26 - VAFBE_33','Reporting starts':day,'Account Group':'Secondary','Brand':'English',
  'Ad ID':'120255686712150664','Amount spent (IDR)':spend,Results:results,Leads:leads,Booking:booking
 }));
 const tct=run(tctRows);
 check('Live TCT seven-day totals reconcile to source',tct.operational.spend===673987&&tct.operational.results===23&&tct.operational.leads===47&&tct.operational.booking===1);
 check('Live TCT becomes K5 review, with existing other kill rules respected',tct.state==='CRITICAL'&&!has(tct,'K5')&&tct.actionEvidence.k5ReviewProtected&&tct.actionEvidence.killCodes.length===0);
 check('TCT review keeps the 7-day source window',tct.actionEvidence.start==='2026-11-09'&&tct.actionEvidence.end==='2026-11-15');

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
 check('Evidence version recorded',ev().actionEvidence.version==='main-metrics-v7-k5-funnel-review');
 check('Live candidates never kill',candidates().every(g=>['ITERATE','OPPORTUNITY'].includes(g.state)&&!g.killReasons.length));
 return checks;
})()
