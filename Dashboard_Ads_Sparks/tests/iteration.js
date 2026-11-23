(() => {
  const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw new Error(name);};
  const cfg={target:30000,minSpend:90000,minResults:5};
  const make=(ad,spend,results,leads,booking,extras={})=>A.normalize([{'Campaign name':'Traffic_WA_Main','Ad set name':'BHI_T_M_W','Ad name':ad,'Ad Trim':'V_TEST','Reporting starts':'2026-10-01','Amount spent (IDR)':spend,'Results':results,'Leads':leads,'Booking':booking,'Impressions':1000,'Result type':'Messaging conversations started',...extras}])[0];
  const wrap=r=>({...r,...A.aggregate([r]),items:[r],start:r.day,end:r.day,state:'EVALUATE'});
  const strong=make('strong',120000,10,8,4),weak=make('weak',240000,6,2,1);
  const select=(r,rs)=>Iteration.select([wrap(r)],rs,cfg);
  check('Evaluation does not exclude strong main metrics',select(strong,[strong,weak])[0].opportunities.length===2);
  check('Kill ad cannot be an iteration candidate',Iteration.select([{...wrap(strong),state:'KILL'}],[strong,weak],cfg).length===0);
  check('Dominated weak ad is excluded',select(weak,[strong,weak]).length===0);
  check('Target-compliant ad qualifies without peers',select(strong,[strong]).length===1);
  check('Other ad sets cannot establish benchmark',select(strong,[strong,{...weak,adset:'different'}])[0].iterationBenchmark.rows===0);
  check('Other result types cannot establish benchmark',select(strong,[strong,{...weak,resultType:'different'}])[0].iterationBenchmark.rows===0);
  check('Other periods excluded',select(strong,[strong,{...weak,day:'2026-11-01'}])[0].iterationBenchmark.rows===0);
  check('Minimum sample retained',select({...strong,spend:89999},[weak]).length===0);
  const missing={...weak,booking:null};
  check('Missing booking blocks only booking category',select(strong,[strong,missing])[0].opportunities.every(o=>o.key!=='booking'));
  const early=make('early',100000,10,4,1),zero=make('zero',200000,0,0,0);
  check('Single booking cannot qualify for Booking iteration',!select(early,[early,zero])[0].opportunities.some(o=>o.key==='booking'));
  const costly=make('costly',400000,10,5,2),worse=make('worse',800000,6,2,1);
  check('Relative winner still must meet a cost target and outcome sample',select(costly,[costly,worse]).length===0);
  const high=make('high',200000,30,10,5),efficient=make('efficient',100000,20,8,4),drag=make('drag',900000,5,1,0);
  check('Volume and efficiency tradeoffs both retained',Iteration.select([wrap(high),wrap(efficient)],[high,efficient,drag],cfg).length===2);
  const oldStart=$('startFilter').value,oldEnd=$('endFilter').value;
  try{
    $('startFilter').value='2026-10-01';$('endFilter').value='2026-10-30';navigate('overview');
    const wins=candidates();
    check('No kill candidates in live October selection',wins.every(g=>g.state!=='KILL'));
    check('Eight center metric charts rendered',document.querySelectorAll('[data-center-metric]').length===8);
    for(const key of ['results','leads','booking','cpr','cpl','cpb']){
      const points=centerChartData(key);
      check(key+' center chart matches independently aggregated source',points.every(p=>{const r=selected.filter(r=>r.center===p.center);if(!r.length)return p.value===null;const sum=(items,k)=>items.reduce((n,x)=>n+(x[k]||0),0);if(key==='results')return p.value===sum(r,'results');if(key==='leads'||key==='booking'){const known=r.filter(x=>Number.isFinite(x[key]));return p.value===(known.length?sum(known,key):null);}const denominator=key==='cpr'?'results':key==='cpl'?'leads':'booking';const known=r.filter(x=>Number.isFinite(x[denominator]));const expected=known.length===r.length&&sum(r,denominator)>0?sum(r,'spend')/sum(r,denominator):null;return p.value===expected;}));
    }
    $('viewContent').querySelector('[data-action="winners"]').click();
    check('Candidate shortcut opens meeting iteration',view==='meeting'&&meetingTab==='iterate');
    for(const {key} of Iteration.categories){
      const expected=wins.filter(g=>g.opportunities.some(o=>o.key===key));
      const button=document.querySelector('[data-iteration-category="'+key+'"]');
      if(!expected.length){check(key+' is unavailable without candidates',!button||button.disabled);continue;}
      button.click();
      const visible=[...document.querySelectorAll('#iterationCandidates tbody [data-detail]')].map(b=>b.dataset.detail);
      check(key+' shows exactly the eligible ads',visible.length===expected.length&&expected.every(g=>visible.includes(String(g.id))));
    }
    check('All displayed candidates have sample and target support',wins.every(g=>g.spend>=config.minSpend&&g.results>=config.minResults&&g.opportunities.every(o=>CostTargets.meets(g[o.cost],o.cost,config))));
    checks.push({name:'October live candidate counts',ok:true,unique:wins.length,categories:Object.fromEntries(Iteration.categories.map(c=>[c.key,wins.filter(g=>g.opportunities.some(o=>o.key===c.key)).length]))});
    check('Candidates include add to meeting actions',!!document.querySelector('[data-meeting-ad]'));
  }finally{$('startFilter').value=oldStart;$('endFilter').value=oldEnd;navigate('overview');}
  return checks;
})()
