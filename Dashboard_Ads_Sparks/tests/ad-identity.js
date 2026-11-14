(() => {
 const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
 const saved={rows,scope,view,delivery:adsetDelivery,grain:explorerGrain,expanded:[...expandedAdsets]};
 const ids=['accountFilter','centerFilter','brandFilter','objectiveFilter','resultFilter','roleFilter','messageFilter','startFilter','endFilter','searchFilter'],filters=Object.fromEntries(ids.map(id=>[id,$(id).value]));
 const make=(id,status,spend,results)=>({'Campaign name':'Traffic','Ad set name':'DPK_T_D_W_1/11/26','Ad name':'1/11/26 - VEXTR_30','Ad ID':id,'Account Group':'Secondary','Brand':'English','Day':'2026-11-09','Amount spent (IDR)':spend,'Results':results,'Result type':'Messaging conversations started','Ad delivery':status,'Leads':null,'Booking':null});
 try {
  const source=A.normalize([make('111','active',100000,10),make('222','inactive',300000,2)]);
  check('Confirmed different IDs with same name remain two ads',new Set(source.map(A.adIdentity)).size===2);
  check('Distinct source rows keep spend and Results',A.aggregate(source).spend===400000&&A.aggregate(source).results===12);
  const one=A.normalize([make('111','active',100000,10),make('','active',100000,10)]);
  check('Unambiguous historical rows without IDs stay with the same named ad',new Set(one.map(A.adIdentity)).size===1);
  const unknown=A.normalize([make('111','active',1,1),make('222','active',1,1),make('','active',1,1)]);
  check('ID-less row is not guessed when two IDs are possible',new Set(unknown.map(A.adIdentity)).size===3);
  rows=source;scope='ALL';adsetDelivery='all';
  for(const id of ['accountFilter','centerFilter','objectiveFilter','resultFilter','roleFilter','messageFilter'])$(id).value='ALL';
  $('brandFilter').value='English';$('startFilter').value='2026-11-09';$('endFilter').value='2026-11-09';$('searchFilter').value='';updateOptions();render();
  check('Creative Explorer keeps two same-name ads',creatives.length===2);
  explorerGrain='daily';check('Daily comparisons keep both ID-specific creatives',comparisonData().entities.length===2);
  const groups=adsetPerformanceData(),set=groups[0];
  check('Ad set table has two children and only one active ad',set.ads.length===2&&set.activeCount===1);
  check('Delivery status does not conflict across different IDs',set.ads.some(a=>a.deliveryState==='active')&&set.ads.some(a=>a.deliveryState==='inactive'));
  check('Per-ad action evidence does not combine spend',set.ads.every(a=>a.operational?.spend===a.spend||a.actionEvidence?.spend===a.spend||actionMetrics(a).spend===a.spend));
  check('Meeting buckets distinguish the two confirmed IDs',new Set(set.ads.map(a=>meetingAdSource(a).entityKey)).size===2);
  check('Meeting snapshots preserve identity',set.ads.every(a=>meetingAdSource(a).snapshot.adIdentityId));
  expandedAdsets.add(set.key);render();check('Same-name children show Ad ID labels',document.querySelectorAll('.adset-child').length===2&&document.querySelector('.adset-child').textContent.includes('Ad ID:'));
  adsetDelivery='active';check('Active-only totals exclude inactive ID',adsetPerformanceData()[0].spend===100000);
  const live=saved.rows.filter(r=>r.adIdentityId);check('Live data has the audited same-name ID collision',live.some(r=>r.adset==='DPK_T_D_W_BA_ OG_3/11/26'));
  return {checks,liveCollisionRows:live.length,liveCollisionIds:[...new Set(live.map(A.adIdentity))].length};
 } finally {rows=saved.rows;scope=saved.scope;adsetDelivery=saved.delivery;explorerGrain=saved.grain;expandedAdsets.clear();saved.expanded.forEach(k=>expandedAdsets.add(k));updateOptions();for(const [id,value] of Object.entries(filters))$(id).value=value;navigate(saved.view);}
})()
