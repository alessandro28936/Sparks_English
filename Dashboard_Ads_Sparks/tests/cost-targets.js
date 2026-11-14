(()=>{
 const checks=[],ok=(name,value)=>{checks.push({name,ok:!!value});if(!value)throw Error(name);};
 const cfg={target:30000,cplTarget:40000,cpbTarget:300000,minSpend:90000,minResults:5};
 const row=(code,spend,results,leads,booking,extra={})=>({center:'MKS',brand:'English',account:'Main',campaign:'WA',adset:'MKS_T_M_W',ad:'1/10/26 - '+code,adCode:code,day:'2026-11-10',objective:'Traffic',resultType:'Messaging conversations started',format:'Image',message:'Message '+code,pillar:'Education',status:'active',spend,results,leads,booking,impressions:10000,clicks:200,views:0,plays3:0,plays100:0,frequency:1,...extra});
 // Spend/Leads/Booking are the user's screenshot values; Results is a synthetic fixture.
 const good=row('IEXBE_13',2351006,300,255,65),cheaper=row('OLD_529',3373198,600,569,160),source=[good,cheaper];
 for(const key of ['cpl','cpb']){
   const rank=ContentRanking.rank(source,'content',key,cfg)[0];
   ok('Both MKS creatives qualify for '+key,rank.top.length===2&&rank.top.some(g=>g.title==='IEXBE_13'));
   ok('No artificial worst MKS creative for '+key,rank.worst.length===0);
   ok('Both qualifying costs remain ordered for '+key,rank.top[0].title==='OLD_529');
   const single=ContentRanking.rank([good],'content',key,cfg)[0];
   ok('No peers needed to meet '+key+' target',single.top.length===1&&single.worst.length===0);
 }
 const s={...good,...A.aggregate([good]),items:[good],start:good.day,end:good.day};
 ok('IEXBE screenshot CPL recomputed accurately',Math.round(s.cpl)===9220);
 ok('IEXBE screenshot CPB recomputed accurately',Math.round(s.cpb)===36169);
 ok('All three cost targets recognized',CostTargets.allMet(s,cfg));
 ok('Targets are inclusive maximums',CostTargets.meets(40000,'cpl',cfg)&&CostTargets.meets(300000,'cpb',cfg)&&!CostTargets.meets(40001,'cpl',cfg));
 ok('Old saved settings retain new default targets',CostTargets.limit('cpl',{target:30000})===40000&&CostTargets.limit('cpb',{})===300000);
 ok('Custom targets override defaults',CostTargets.limit('cpl',{cplTarget:55000})===55000);
 ok('Null and Infinity cannot pass targets',!CostTargets.meets(null,'cpl',cfg)&&!CostTargets.meets(Infinity,'cpb',cfg));
 const bad=row('Expensive',2000000,10,10,2);
 ok('Above-target CPL goes to worst even without peers',ContentRanking.rank([bad],'content','cpl',cfg)[0].worst.length===1);
 ok('Above-target CPB goes to worst',ContentRanking.rank([bad],'content','cpb',cfg)[0].worst.length===1);
 const zero=row('Zero',100000,0,0,0),missing={...zero,ad:'missing',adCode:'missing',leads:null,booking:null};
 ok('Known zero outcomes included, missing outcomes excluded',ContentRanking.rank([zero,missing],'content','cpb',cfg)[0].worst.length===1);
 const wrapped=source.map(r=>({...r,...A.aggregate([r]),items:[r],start:r.day,end:r.day,state:'MONITOR'}));
 ok('Both efficient ads can be iteration candidates',Iteration.select(wrapped,source,cfg).length===2);
 ok('Center-relative winner may qualify above fixed targets',Iteration.select([{...bad,...A.aggregate([bad]),items:[bad],start:bad.day,end:bad.day,state:'MONITOR'}],[bad,{...bad,ad:'worse',spend:4000000}],cfg).length===1);
 ok('Single affordable Booking is not enough for Booking iteration',!Iteration.select([{...s,booking:1,cpb:100000}],source,cfg)[0].opportunities.some(o=>o.key==='booking'));
 const evaluated=Rules.evaluate(s,[],Rules.index(source),cfg);
 ok('MKS recommendation does not fail because peer is cheaper',evaluated.state==='ITERATE');
 const lowRate=row('Low rate',100000,100,40,1),cheapPeer=row('Peer',100000,100,90,10);
 const review=Rules.evaluate({...lowRate,...A.aggregate([lowRate]),items:[lowRate],start:lowRate.day,end:lowRate.day},[],Rules.index([lowRate,cheapPeer]),cfg);
 ok('CPB within target protects K1 despite cheaper peers',review.state!=='KILL'&&review.actionEvidence.protectedBooking);
 const box=document.createElement('table');box.innerHTML='<tbody><tr>'+adsetMetricCells(s,1,wrapped)+'</tr></tbody>';
 ok('Adset CPL within target is green',box.querySelector('[data-adset-metric="cpl"]').classList.contains('good'));
 ok('Adset CPB within target is green',box.querySelector('[data-adset-metric="cpb"]').classList.contains('good'));
 ok('Generic cost output uses CPB tiers',displayMetric(s,'cpb',money).includes('cpb-good'));
 ok('Creative period heat uses target, not peer',metricRuleColor({...s,benchmark:{cpb:1}},'cpb')==='good-heat');
 ok('Incomplete ratio has no positive target color',!displayMetric({...s,leadRows:0,cpl:null,coverage:{cpl:{rows:0,totalRows:1}}},'cpl',money).includes('at-target'));
 return {checks};
})()
