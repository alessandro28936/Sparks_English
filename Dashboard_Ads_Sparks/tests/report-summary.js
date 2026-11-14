(() => {
  const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
  const make=(ad,spend,results,extra={})=>({day:'2026-11-04',center:'BHI',brand:'English',account:'Main',campaign:'Traffic',adset:'BHI_T_M_W_1/5/26',ad,adCode:'SAME',objective:'Traffic',resultType:'Messages',format:'Image',spend,results,leads:null,booking:null,impressions:100,clicks:1,views:100,plays3:0,plays100:0,frequency:1,raw:{'Report Key':'English|2026-11-04|BHI_T_M_W|SAME'},...extra});
  const a=make('1/10/26 - SAME',200000,20),b=make('2/10/26 - SAME',100000,10),source=[a,b];
  const reports=[{tier:'legacy',key:a.raw['Report Key'],leads:24,booking:3}],idx=ReportSummary.index(source,reports);
  const total=ReportSummary.aggregate(source,idx);
  check('Shared creative recovered once within proven ad set',total.leads===24&&total.booking===3&&total.cpl===12500&&total.cpb===100000);
  check('Summary Results-to-Leads and booking conversion use same group',total.leadRate===80&&total.bookingRate===12.5);
  check('Individual ad never gets the shared outcome',ReportSummary.aggregate([a],idx).leadRows===0);
  check('Search or delivery subset cannot import hidden ads outcomes',ReportSummary.aggregate([b],idx).bookingRows===0);
  check('Raw ad outcomes remain unknown',a.leads===null&&a.booking===null&&b.leads===null);
  check('No source spend or Results mutated',total.spend===300000&&total.results===30);
  const otherAccount={...b,account:'Secondary'};
  check('Same legacy key across accounts is not assigned',ReportSummary.aggregate([a,otherAccount],ReportSummary.index([a,otherAccount],reports)).leads===0);
  check('Filtering to Main does not bypass global ambiguity',ReportSummary.aggregate([a],ReportSummary.index([a,otherAccount],reports)).leadRows===0);
  const otherSet={...b,adset:'BHI_T_M_W_2/5/26'};
  check('Different full ad sets sharing trim remain ambiguous',ReportSummary.aggregate([a,otherSet],ReportSummary.index([a,otherSet],reports)).leadRows===0);
  const otherCenter={...b,center:'CBN',adset:'CBN_T_M_W_1/5/26',raw:{'Report Key':'English|2026-11-04|CBN_T_M_W|SAME'}};
  const otherReport={tier:'legacy',key:otherCenter.raw['Report Key'],leads:7,booking:1};
  check('Identical creative code in another center is isolated',ReportSummary.aggregate([a,b,otherCenter],ReportSummary.index([a,b,otherCenter],[...reports,otherReport])).leads===31);
  const setB={...b,account:'Secondary',adset:'BHI_T_D_W_2/5/26',raw:{'Report Key':'English|2026-11-04|BHI_T_D_W|SAME'}};
  const twoReports=[...reports,{tier:'legacy',key:setB.raw['Report Key'],leads:8,booking:1}],twoIdx=ReportSummary.index([a,b,setB],twoReports);
  check('BHI Main ad set A and Secondary ad set B match independently',ReportSummary.aggregate([a,b,setB],twoIdx).leads===32&&ReportSummary.aggregate([setB],twoIdx).leads===8);
  check('Explicit account keys can resolve same legacy key',ReportSummary.aggregate([a,otherAccount],ReportSummary.index([a,otherAccount],[{tier:'account',key:a.raw['Report Key']+'|Main',leads:10,booking:1},{tier:'account',key:a.raw['Report Key']+'|Secondary',leads:5,booking:1}])).leads===15);
  const third={...b,account:'Third'},three=[a,otherAccount,third];
  check('Three accounts with identical names never share legacy outcomes',ReportSummary.aggregate(three,ReportSummary.index(three,reports)).leadRows===0);
  const scopedReports=['Main','Secondary','Third'].map((account,i)=>({tier:'account',key:a.raw['Report Key']+'|'+account,leads:i+1,booking:i}));
  const threeIndex=ReportSummary.index(three,scopedReports);
  check('Third account report outcomes are independently matched',ReportSummary.aggregate([third],threeIndex).leads===3&&ReportSummary.aggregate([third],threeIndex).booking===2);
  check('Three account outcomes sum exactly once',ReportSummary.aggregate(three,threeIndex).leads===6);
  const known={...a,leads:20,booking:2};
  check('Known ad outcomes not counted twice from report totals',ReportSummary.aggregate([known,b],ReportSummary.index([known,b],reports)).leads===20);
  check('Duplicate source report records do not multiply results',ReportSummary.aggregate(source,ReportSummary.index(source,[...reports,...reports])).leads===24);
  const incomplete=ReportSummary.aggregate([a,b,{...otherCenter,raw:{'Report Key':'unmatched'}}],idx);
  const metric=summaryMetric(incomplete,'cpl',money);
  check('Incomplete summary retains a correctly scoped CPL',metric.value===12500&&metric.note.includes('300.000')&&metric.note.includes('24 Leads')&&metric.note.includes('2/3'));
  check('Full-period table CPL stays unavailable for incomplete report',metricDisplayData(incomplete,'cpl').value===null);
  check('Summary conversion explicitly reveals numerator and denominator',summaryMetric(incomplete,'leadRate',percent).note.includes('24 Leads / 30 Results'));
  check('Summary booking conversion uses paired outcomes',summaryMetric(incomplete,'bookingRate',percent).value===12.5);
  const mixed=resultTypeSummary([known,{...known,ad:'Other',resultType:'Clicks',results:100}],'cpr');
  check('Mixed CPR shows separate valid costs with result labels',mixed.includes('Messages')&&mixed.includes('Clicks')&&mixed.includes('Rp10.000')&&mixed.includes('Rp2.000'));
  // Historical reports are never guessed by creative code alone.
  // Every 20/21 October alias must be scoped to verified Ad ID, account, full ad set, and day.
  const historicalAliases=[
    ['TMP','TMP_T_M_W_1/5/26','120249046668610027','IAFBEOE_95','IAFBEOE_98','2026-10-20',null],
    ['CBN','CBN_T_M_W_1/5/26','120249046417170027','IAFBEOE_95','IAFBEOE_96','2026-10-20',null],
    ['GLK','GLK_T_M_W_17/4/26','120249046440240027','IAFBEOE_95','IAFBEOE_97','2026-10-20',null],
    ['BTR','BTR_T_D_W_OG_21/10/26','120249061519580027','IAFBEOE_95',null,'2026-10-21','BTR_T_D_W'],
    ['BTR','BTR_T_D_W_OG_21/10/26','120249061519540027','IAFSC_37',null,'2026-10-21','BTR_T_D_W'],
    ['BTR','BTR_T_D_W_OG_21/10/26','120249061519560027','OLD_10',null,'2026-10-21','BTR_T_D_W'],
    ['BTR','BTR_T_D_W_OG_21/10/26','120249061519530027','OLD_41',null,'2026-10-21','BTR_T_D_W'],
    ['BTR','BTR_T_D_W_OG_21/10/26','120249061519590027','OLD_18',null,'2026-10-21','BTR_T_D_W']
  ];
  for(const [center,adset,adId,code,oldCode,day,oldAdset] of historicalAliases){
    const set=adset.slice(0,adset.lastIndexOf('_'));
    const key=`English|${day}|${set}|${code}`,oldKey=`English|${day}|${oldAdset||set}|${oldCode||code}`;
    const original={...make('21/10/26 - '+code,11000,1),day,center,adset,adCode:code,account:'Main',raw:{'Report Key':key,'Account ID':'304705508911066','Ad ID':adId}};
    const historic=[{tier:'legacy',key:oldKey,leads:0,booking:0}];
    const matched=applyVerifiedOutcomeAliases([original],historic);
    check('Verified alias matched '+center+'/'+code,matched.length===2&&matched[1].tier==='id'&&matched[1].leads===0&&matched[1].booking===0);
    fillUniqueOutcomeReports([original],ReportSummary.index([original],matched));
    check('Verified zero stays zero '+center+'/'+code,original.leads===0&&original.booking===0);
    check('Wrong Ad ID is blocked '+center+'/'+code,applyVerifiedOutcomeAliases([{...original,raw:{...original.raw,'Ad ID':'000000000000000000'}}],historic).length===1);
    check('Wrong account is blocked '+center+'/'+code,applyVerifiedOutcomeAliases([{...original,account:'Secondary'}],historic).length===1);
    const later=day==='2026-10-20'?'2026-10-21':'2026-10-22';
    const other={...original,day:later,raw:{...original.raw,'Report Key':`English|${later}|${set}|${code}`}};
    const laterReport=[{tier:'legacy',key:`English|${later}|${oldAdset||set}|${oldCode||code}`,leads:3,booking:2}];
    check('Alias is restricted to approved date '+center+'/'+code,applyVerifiedOutcomeAliases([other],laterReport).length===1);
    check('Current-name report takes precedence '+center+'/'+code,applyVerifiedOutcomeAliases([original],[...historic,{tier:'legacy',key,leads:6,booking:1}]).length===2);
  }
  // A single legacy outcome report must not be applied to two competing historical aliases.
  const aliasFirst={...make('20/10/26 - IAFBEOE_95',5000,0),day:'2026-10-20',center:'TMP',adset:'TMP_T_M_W_1/5/26',adCode:'IAFBEOE_95',account:'Main',raw:{'Report Key':'English|2026-10-20|TMP_T_M_W|IAFBEOE_95','Account ID':'304705508911066','Ad ID':'120249046668610027'}};
  const competing={...aliasFirst,raw:{...aliasFirst.raw,'Ad ID':'120249046417170027'},adset:'CBN_T_M_W_1/5/26',center:'CBN'};
  const claimed=applyVerifiedOutcomeAliases([aliasFirst,competing],[{tier:'legacy',key:'English|2026-10-20|TMP_T_M_W|IAFBEOE_98',leads:0,booking:0}]);
  check('Historic alias is never allocated to an unverified competitor',claimed.filter(r=>r.tier==='id').length===1);

  check('Report Totals synced for live source',!reportSummaryError&&reportSummaryIndex?.buckets.length>0);
  const live=summaryAggregate(selected);
  check('Summary cannot reduce already matched Leads',live.leads>=A.aggregate(selected).leads);
  check('Ad set recovery keeps total spend unchanged',live.spend===A.aggregate(selected).spend);
  const before={objective:$('objectiveFilter').value,delivery:adsetDelivery};let allObjectives;
  try{
    $('objectiveFilter').value='ALL';adsetDelivery='all';refreshData();
    const s=summaryAggregate(selected);allObjectives={spend:s.spend,results:s.results,leads:s.leads,booking:s.booking,cpl:s.cpl,cpb:s.cpb,bookingRate:s.bookingRate,matched:s.leadRows,rows:s.rows,recovered:s.recovered.length,types:[...s.types]};
    check('All-objective summary offers numeric matched CPL and CPB',Number.isFinite(summaryMetric(s,'cpl',money).value)&&Number.isFinite(summaryMetric(s,'cpb',money).value));
    check('All-objective CPR exposes per-type amounts',!s.mixed||resultTypeSummary(selected,'cpr').includes('Rp'));
    check('All-objective booking conversion available from consistent rows',Number.isFinite(summaryMetric(s,'bookingRate',percent).value));
    const parents=adsetPerformanceData();check('Ad-set summary Leads reconcile to Overview when all delivery shown',parents.reduce((n,g)=>n+g.leads,0)===s.leads);
    check('Ad-set summary Booking reconcile to Overview when all delivery shown',parents.reduce((n,g)=>n+g.booking,0)===s.booking);
    check('Individual ad counts remain original source counts',parents.flatMap(g=>g.ads).every(ad=>ad.leads===A.aggregate(ad.items).leads));
  }finally{$('objectiveFilter').value=before.objective;adsetDelivery=before.delivery;refreshData();}
  return {checks,buckets:reportSummaryIndex.buckets.length,selected:{spend:live.spend,leads:live.leads,booking:live.booking,recovered:live.recovered.length,matched:live.leadRows,rows:live.rows},allObjectives,syncError:reportSummaryError};
})()
