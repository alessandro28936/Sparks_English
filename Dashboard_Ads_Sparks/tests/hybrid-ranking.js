(()=>{
 const checks=[],ok=(name,v)=>{checks.push({name,ok:!!v});if(!v)throw Error(name);};
 const cfg={target:30000,cplTarget:40000,cpbTarget:300000,minSpend:90000,minResults:5};
 const r=(code,spend,leads,booking,extra={})=>({center:'BHI',brand:'English',account:'Main',campaign:'WA',adset:'BHI_T_M_W',ad:'1/10/26 - '+code,adCode:code,day:'2026-11-10',objective:'Traffic',resultType:'Messaging conversations started',format:'Image',message:'Message '+code,pillar:'Education',status:'active',spend,results:leads,leads,booking,impressions:10000,clicks:200,views:0,plays3:0,plays100:0,frequency:1,...extra});
 const safe=r('Safe',2400000,40,6),expensive=r('Expensive',4800000,40,6),source=[safe,expensive];
 for(const key of ['cpl','cpb']){
   const result=ContentRanking.rank(source,'content',key,cfg)[0],item=result.top[0];
   ok('Above-target center-efficient content qualifies for '+key,item.title==='Safe'&&!item.withinTarget&&item.withinCenter);
   ok('Only truly expensive content is worst '+key,result.worst.length===1&&result.worst[0].title==='Expensive');
   ok('No overlap '+key,!result.top.some(a=>result.worst.some(b=>a.key===b.key)));
 }
 const ref=CostTargets.benchmark(source,[safe],'cpl',cfg);
 ok('Candidate excluded from center reference',ref.cost===120000&&ref.count===40&&ref.spend===4800000);
 const otherSet={...expensive,adset:'BHI_other'},otherAccount={...expensive,account:'Secondary',ad:'Other'};
 ok('Comparison spans other ad sets and selected accounts',CostTargets.benchmark([safe,otherSet,otherAccount],[safe],'cpl',cfg).ads===2);
 ok('Other centers cannot establish safe reference',!CostTargets.benchmark([safe,{...expensive,center:'CBN'}],[safe],'cpl',cfg).ready);
 ok('Other brands cannot establish safe reference',!CostTargets.benchmark([safe,{...expensive,brand:'SLSA'}],[safe],'cpl',cfg).ready);
 ok('Different results cannot establish safe reference',!CostTargets.benchmark([safe,{...expensive,resultType:'Link clicks'}],[safe],'cpl',cfg).ready);
 const incomplete=[safe,expensive,{...expensive,day:'2026-11-09',leads:null}];
 ok('Incomplete peer ad excluded in full',!CostTargets.benchmark(incomplete,[safe],'cpl',cfg).ready);
 ok('Incomplete Leads do not prevent valid Booking reference',CostTargets.benchmark(incomplete,[safe],'cpb',cfg).ready);
 ok('Insufficient peer sample is not a safe benchmark',!CostTargets.benchmark([safe,{...expensive,leads:4}],[safe],'cpl',cfg).ready);
 ok('Filter to one content retains base center comparison',ContentRanking.rank([safe],'content','cpl',cfg,source)[0].top.length===1);
 const labeled=[{...safe,message:'Cost'},{...expensive,message:'Other'}];
 ok('Message grouping uses same center reference',ContentRanking.rank(labeled,'message','cpl',cfg,labeled)[0].top[0].title==='Cost');
 const tiny=r('Cheap small',200000,10,5),big=r('Big generator',2400000,40,6),drag=r('Drag',12000000,40,6);
 const byCost=ContentRanking.rank([tiny,big,drag],'content','cpl',cfg,undefined,'cost')[0],byCount=ContentRanking.rank([tiny,big,drag],'content','cpl',cfg,undefined,'outcomes')[0];
 ok('Cost sort prioritizes efficiency',byCost.top[0].title==='Cheap small');
 ok('Outcome sort finds the biggest qualified generator',byCount.top[0].title==='Big generator');
 const alone=ContentRanking.rank([safe],'content','cpb',cfg)[0];
 ok('No center benchmark does not invent safety',alone.top.length===0&&alone.worst[0].benchmark===null);
 const affordable=[r('Good',1000000,100,50),r('Cheaper',1000000,200,100)];
 ok('Affordable content is never worst because a peer is cheaper',ContentRanking.rank(affordable,'content','cpb',cfg)[0].worst.length===0);
 const wrap=x=>({...x,...A.aggregate([x]),items:[x],start:x.day,end:x.day,state:'MONITOR'});
 const candidate=Iteration.select([wrap(safe)],[safe],cfg,source)[0];
 ok('Meeting iteration accepts center-relative outcomes',candidate?.opportunities.some(o=>o.key==='leads')&&candidate.opportunities.some(o=>o.key==='booking'));
 ok('Reason explicitly discloses above target and center mean',candidate.opportunities[0].reason.includes('di atas target')&&candidate.opportunities[0].reason.includes('center'));
 const evaluated=Rules.evaluate(wrap(safe),[],Rules.index(source),cfg);
 ok('Operational rules use the same center-relative criterion',evaluated.state==='ITERATE');
 const oldMetric=contentRankMetric;
 try{contentRankMetric='cpb';const rank=ContentRanking.rank(source,'content','cpb',cfg)[0],box=document.createElement('div');box.innerHTML=renderContentRankTable(rank.top,'top');
   ok('Top row has red cost background when above fixed target',!!box.querySelector('.content-rank-cost.worst'));
   ok('Center-relative label is visible',box.textContent.includes('within center average'));
   ok('All three costs are visible',box.textContent.includes('CPR')&&box.textContent.includes('CPL'));
 }finally{contentRankMetric=oldMetric;}
 ok('Current center references override stale operational metadata',actionMetrics({iterationBenchmarkCosts:{cpl:120000},operational:{iterationBenchmarkCosts:{cpl:1}}}).iterationBenchmarkCosts.cpl===120000);
 return {checks};
})()
