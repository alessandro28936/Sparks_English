(() => {
 const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
 const ids=['accountFilter','centerFilter','brandFilter','objectiveFilter','resultFilter','roleFilter','campaignFilter','messageFilter','startFilter','endFilter','searchFilter'];
 const before={scope,workView,chartGrain,view,filters:Object.fromEntries(ids.map(id=>[id,$(id).value]))};
 try{
  scope='MY';workView='all';for(const id of ids)if(!['startFilter','endFilter','searchFilter'].includes(id))$(id).value='ALL';$('searchFilter').value='';$('startFilter').value='2026-10-26';$('endFilter').value='2026-11-08';updateOptions();refreshData();
  const managed=selected.slice(),third=managed.filter(r=>r.account==='Third');
  check('Third assigned ad set has real imported rows',third.length>0);
  check('My scope contains exactly the assigned Third ad set',third.every(r=>r.adset===MY_THIRD_ADSET));
  check('Third JU maps to CL.JU',third.every(r=>r.center==='CL.JU'));
  check('Main and Secondary same centers stay in scope',managed.some(r=>r.account==='Main')&&managed.some(r=>r.account==='Secondary'));
  workView='preheat';updateOptions();refreshData();const preheat=selected.slice();
  check('Preheat is reachable from My assignments',preheat.length>0&&preheat.every(isPreheat));
  check('Preheat campaign selector offers CBO campaign',[...$('campaignFilter').options].some(o=>o.value.includes('Traffic_WA_EXP_CBO_NEW')));
  $('campaignFilter').value=[...$('campaignFilter').options].find(o=>o.value.includes('Traffic_WA_EXP_CBO_NEW')).value;refreshData();
  check('Campaign selector filters exact campaign',selected.length>0&&selected.every(r=>r.campaign===$('campaignFilter').value));
  $('campaignFilter').value='ALL';workView='centers';updateOptions();refreshData();
  check('Centers excludes C.IN',selected.length>0&&selected.every(r=>!isPreheat(r)));
  check('All work is the disjoint union of Centers and Preheat',selected.length+preheat.length===managed.length);
  scope='ALL';workView='all';updateOptions();refreshData();
  check('Other Third ad sets remain accessible in All assignments',selected.some(r=>r.account==='Third'&&r.adset!==MY_THIRD_ADSET));
  scope='MY';workView='all';updateOptions();refreshData();
  const cbn=rows.filter(r=>r.center==='CBN'&&r.adCode==='IAFSCNG_46'&&temporalFilter(r)),tct=rows.filter(r=>r.center==='TCT'&&r.adCode==='VAFCU_89'&&r.day==='2026-10-26');
  check('CBN missing report is clearly identified',cbn.length>0&&reportIssueLabel(A.aggregate(cbn),'leads')==='Missing Leads');
  check('TCT duplicated ad code is identified as ambiguous',tct.length>1&&reportIssueLabel(A.aggregate(tct),'leads')==='Ambiguous ad match');
  check('Ad-set missing ratios still stay unknown',metricDisplayData(A.aggregate(cbn),'cpl').value===null);
  const sample=selected[0],items=[{...sample,day:'2026-11-01',spend:100,results:10,leads:5,booking:1},{...sample,day:'2026-11-02',spend:900,results:50,leads:null,booking:null}],s=A.aggregate(items);
  check('Matched CPL excludes spend with unknown Leads',overviewReading(s,'cpl').value===20);
  check('Matched CPB excludes spend with unknown Booking',overviewReading(s,'cpb').value===100);
  check('Matched conversion uses Results from the same rows',overviewReading(s,'leadRate').value===50);
  check('Recorded daily Leads uses all observed days',PeriodLearning.daily(s,'leads')===2.5);
  check('Known zero Booking has no invented CPB',overviewReading(A.aggregate([{...sample,booking:0}]),'cpb').value===null);
  for(const grain of ['daily','weekly','monthly']){
   chartGrain=grain;navigate('overview');
   check(grain+' period table renders',document.querySelectorAll('.period-values .period-data').length>0);
   for(const key of ['leads','booking','cpl','cpb','bookingRate','results','cpr','leadRate']){
    check(grain+' '+key+' chart has numeric points with All objectives/accounts',document.querySelectorAll(`[data-metric="${key}"] svg circle`).length>0);
    check(grain+' '+key+' center chart retains known values',centerChartData(key).some(r=>Number.isFinite(r.value)));
   }
   check(grain+' matched period figures appear',document.querySelector('.period-values').textContent.includes('Matched data'));
   check(grain+' incomplete comparisons have neutral color',[...document.querySelectorAll('.period-metric')].filter(e=>e.querySelector('.report-state')?.textContent==='Matched data').every(e=>e.classList.contains('neutral')));
  }
  check('All-objective result tables expose context',document.querySelector('.period-contexts').textContent.includes('Messaging conversations started'));
  check('Period comparison control has one unique ID',document.querySelectorAll('#periodComparison').length===1);
  $('periodComparison').value='average';$('periodComparison').dispatchEvent(new Event('change',{bubbles:true}));
  check('Changing comparison preserves separated result contexts',!!document.querySelector('.period-contexts')&&document.querySelectorAll('#periodComparison').length===1);
  check('Changing comparison preserves matched CPB figures',document.querySelector('.period-primary [data-period-metric="cpb"]').textContent.includes('Rp'));
  $('periodComparison').value='previous';$('periodComparison').dispatchEvent(new Event('change',{bubbles:true}));
  check('Overview contains no generic Incomplete labels',!document.querySelector('#viewContent').textContent.includes('Incomplete data'));
  const contexts=overviewGroups(selected,'cpr');
  check('Mixed CPR partitions all spend without duplication',contexts.reduce((n,g)=>n+g.spend,0)===A.aggregate(selected).spend);
  check('CPR contexts are internally consistent',contexts.every(g=>new Set(g.items.map(resultContext)).size===1));
  const from=trendHistoryRows();check('Comparison history follows Third and Preheat ownership',from.every(ownedRow));
  for(const account of ['Main','Secondary','Third']){ $('accountFilter').value=account;updateOptions();refreshData();check(account+' filter isolates the account',selected.length>0&&selected.every(r=>r.account===account)); }
  return {checks,managedRows:managed.length,thirdRows:third.length,preheatRows:preheat.length};
 }finally{scope=before.scope;workView=before.workView;chartGrain=before.chartGrain;for(const [id,v]of Object.entries(before.filters))$(id).value=v;updateOptions();navigate(before.view);}
})()
