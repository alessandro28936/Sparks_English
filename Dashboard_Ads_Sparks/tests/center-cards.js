(()=>{
 const checks=[],ok=(name,value)=>{checks.push({name,ok:!!value});if(!value)throw Error(name);};
 const row=(ad,spend,leads,booking,extra={})=>({ad,brand:'English',account:'Main',center:'BHI',campaign:'WA',adset:'BHI_T_M_W',adCode:'SAME',day:'2026-11-04',objective:'Traffic',resultType:'Messages',format:'Image',spend,results:20,leads,booking,impressions:100,clicks:1,views:0,plays3:0,plays100:0,frequency:1,raw:{'Report Key':'English|2026-11-04|BHI_T_M_W|SAME'},...extra});
 const dom=s=>{const box=document.createElement('div');box.innerHTML=centerSummaryMetricStrip(s);return box;};
 const value=(box,key)=>box.querySelector(`[data-center-metric="${key}"] b`).textContent;
 const a=row('A',200000,null,null),b=row('B',100000,null,null),reports=[{tier:'legacy',key:a.raw['Report Key'],leads:24,booking:3}],idx=ReportSummary.index([a,b],reports);
 const recovered=ReportSummary.aggregate([a,b],idx),full=dom(recovered);
 ok('Center cards recover shared Leads once',value(full,'leads')===integer(24)&&value(full,'booking')===integer(3));
 ok('Recovered center CPL and CPB use same scope',value(full,'cpl')===money(12500)&&value(full,'cpb')===money(100000));
 ok('Recovery never mutates individual outcomes',a.leads===null&&b.booking===null);
 const missing=row('C',900000,null,null,{raw:{'Report Key':'other'}}),partial=ReportSummary.aggregate([a,b,missing],idx),part=dom(partial);
 ok('Partial CPL uses matched spend rather than full spend',value(part,'cpl')===money(12500)&&value(part,'cpl')!==money(50000));
 ok('Partial CPB and conversion remain available',value(part,'cpb')===money(100000)&&value(part,'bookingRate')===percent(12.5));
 ok('Partial cost is explicitly labelled',part.querySelector('[data-center-metric="cpl"] .summary-basis').textContent==='Matched data');
 ok('Coverage explains numerator denominator and matching count',centerSummaryCoverage(partial).includes('2/3 rows')&&centerSummaryCoverage(partial).includes(money(300000))&&centerSummaryCoverage(partial).includes('24 Leads'));
 ok('Observed values match Overview exactly',overviewReading(partial,'cpl').value===summaryMetric(partial,'cpl',money).value);
 const pair=A.aggregate([row('A',100000,10,2),row('B',100000,90,null),row('C',100000,null,9)]),paired=dom(pair);
 ok('Booking conversion uses only rows with both outcomes',value(paired,'bookingRate')===percent(20));
 const unknown=dom(A.aggregate([missing]));
 ok('Fully missing outcomes do not become zero',value(unknown,'leads')===integer(null)&&value(unknown,'cpl')===money(null));
 const zero=dom(A.aggregate([row('Z',100000,0,0)]));
 ok('Confirmed zero outcomes remain zero with undefined cost',value(zero,'leads')===integer(0)&&value(zero,'booking')===integer(0)&&value(zero,'cpb')===money(null));
 ok('Complete zero outcome is not labelled as missing',!zero.querySelector('.summary-basis'));
 const empty=dom(A.aggregate([]));
 ok('No data is not displayed as zero results',value(empty,'results')===integer(null));
 const stable=A.aggregate([row('K',100000,10,1,{resultType:'Messaging conversations started'}),row('Z',20000,0,0,{results:0,resultType:'Tidak tercatat'})]);
 ok('Zero-result WhatsApp rows do not force a false validation badge',!stable.mixed&&A.state(stable,{target:30000,minSpend:90000,minResults:5})!=='MIXED');
 return {checks};
})()
