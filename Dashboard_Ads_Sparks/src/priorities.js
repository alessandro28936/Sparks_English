let priorityTab='sets',priorityShowAll=false,priorityData={ads:[],sets:[],validation:0};
function priorityIssues(s,items,source){
  if(s.spend<config.minSpend)return [];
  const issues=[];
  for(const [cost,count,label] of [['cpr','results','Results'],['cpl','leads','Leads'],['cpb','booking','Booking']]){
    const reading=metricDisplayData(s,count),target=CostTargets.limit(cost,config);
    if(reading.partial||reading.value===null||cost==='cpr'&&s.mixed)continue;
    if(reading.value===0&&s.spend>=Math.max(config.minSpend,target)){issues.push({text:`0 ${label} · spend ${money(s.spend)}`,severity:count==='results'?1:2});continue;}
    const value=metricDisplayData(s,cost);if(value.partial||!Number.isFinite(value.value)||value.value<=target)continue;
    if(cost==='cpb'){issues.push({text:`CPB ${money(value.value)} · ${CostTargets.cpbLabel(value.value)}`,severity:value.value>500000?1:value.value>400000?2:3});continue;}
    const ref=CostTargets.benchmark(source,items,cost,config);
    if(ref.ready&&value.value<=ref.cost)continue;
    issues.push({text:`${cost.toUpperCase()} ${money(value.value)} > target ${money(target)}${ref.ready?' & center '+money(ref.cost):' · center average unavailable'}`,severity:2});
  }
  if(s.results>=config.minResults&&s.leadRows===s.rows&&Number.isFinite(s.leadRate)&&s.leadRate<80)issues.push({text:`Results → Leads ${percent(s.leadRate)} <80%`,severity:3});
  return issues;
}
function buildPriorities(){
  const active=[...new Map(creatives.filter(g=>g.lastDelivery==='active'&&g.operational?.rows).map(g=>[Rules.identity(g),g])).values()],source=rows.filter(r=>workspaceMatches(r)&&accountMatches(r));
  const ads=active.map(g=>{
    const s=g.operational,items=s.items,peers=source.filter(r=>r.day>=s.start&&r.day<=s.end),issues=priorityIssues(s,items,peers);
    if(g.state==='KILL')issues.unshift({text:g.killReasons?.[0]||'Review kill recommendation',severity:0});
    return {g,s,items,issues,name:g.ad,center:g.center,account:g.account,adset:g.adset,start:s.start,end:s.end};
  });
  const groups=A.group(active.flatMap(g=>g.operational.items),adsetIdentity);
  const sets=groups.map(group=>{
    const first=group.items[0],members=ads.filter(a=>adsetIdentity(a.g)===adsetIdentity(first));
    const start=members[0].start,end=members[0].end,s=summaryAggregate(group.items),issues=priorityIssues(s,group.items,source.filter(r=>r.day>=start&&r.day<=end));
    const kills=members.filter(a=>a.g.state==='KILL').length;
    if(kills)issues.unshift({text:`${kills} active ${kills===1?'ad':'ads'} recommended for kill`,severity:0});
    return {s,items:group.items,issues,members,name:first.adset,center:first.center,account:first.account,adset:first.adset,start,end};
  });
  const sort=list=>list.filter(a=>a.issues.length).map(a=>({...a,severity:Math.min(...a.issues.map(i=>i.severity))})).sort((a,b)=>a.severity-b.severity||b.s.spend-a.s.spend||a.name.localeCompare(b.name));
  return {ads:sort(ads),sets:sort(sets),validation:active.filter(g=>g.state==='MIXED').length};
}
function priorityRows(list,kind){return list.map((a,i)=>`<tr><td class="priority-entity"><b>${esc(a.center)}</b> ${accountBadge(a.account)}<button class="ad-link" ${kind==='sets'?`data-priority-set="${i}"`:`data-detail="${a.g.id}"`}>${esc(a.name)}</button>${kind==='ads'?`<small>${esc(a.adset)}</small>`:`<small>${a.members.length} active creative groups</small>`}</td><td class="priority-reasons"><span class="pill ${!a.issues.length?'MONITOR':a.issues.some(x=>x.severity===0)?'KILL':'CRITICAL'}">${!a.issues.length?'No main-metric alert':a.issues.some(x=>x.severity===0)?'Kill review':'Review'}</span>${a.issues.map(x=>`<small>${esc(x.text)}</small>`).join('')}</td><td class="num">${money(a.s.spend)}</td>${[['results','cpr'],['leads','cpl'],['booking','cpb']].map(([count,cost])=>`<td class="num">${displayMetric(a.s,count,integer)}<small>${cost.toUpperCase()} ${displayMetric(a.s,cost,money)}</small></td>`).join('')}</tr>`).join('');}
function renderPriorities(){
  const list=priorityData[priorityTab==='sets'?'sets':'ads'],shown=priorityShowAll?list:list.slice(0,3),sample=list[0]||priorityData.ads[0]||priorityData.sets[0];
  return `<section class="card priority-review priority-compact"><div class="card-heading"><div><h2>Review first <span class="priority-count">${list.length}</span></h2><p>${sample?esc(prettyDate(sample.start)+' – '+prettyDate(sample.end)):'Last 7 days'} · Active ads</p></div><div class="scope-switch"><button data-priority-tab="sets" class="${priorityTab==='sets'?'selected':''}">Ad sets (${priorityData.sets.length})</button><button data-priority-tab="ads" class="${priorityTab==='ads'?'selected':''}">Ads (${priorityData.ads.length})</button></div></div>${list.length?`<div class="priority-alert-list">${shown.map((a,i)=>`<button class="priority-alert ${a.severity<=1?'urgent':a.severity===3?'warning':'review'}" ${priorityTab==='sets'?`data-priority-set="${i}"`:`data-detail="${a.g.id}"`}><span class="priority-alert-mark" aria-hidden="true">!</span><span class="priority-alert-content"><span class="priority-alert-meta">${esc(a.center)} · ${esc(a.account)}</span><strong>${esc(a.name)}</strong><span class="priority-alert-reason">${esc(a.issues[0].text)}</span></span><span class="priority-open">Review <span aria-hidden="true">↗</span></span></button>`).join('')}</div>${list.length>3?`<div class="priority-review-footer"><button class="text-button" data-priority-all="true">${priorityShowAll?'Show fewer':'View all '+list.length}</button></div>`:''}`:'<div class="card-body">No main-metric alerts for active '+(priorityTab==='sets'?'ad sets':'ads')+'.</div>'}</section>`;
}

function reviewPrioritySet(index){
  const a=priorityData.sets[index];if(!a)return;
  $('detailContent').innerHTML=`<h2>${esc(a.name)}</h2><p>${esc(a.center)} · ${esc(a.account)} · ${esc(a.start)} — ${esc(a.end)}</p><p class="mini-note">Active ads only. Click an ad for its action evidence and meeting options.</p>${centerSummaryMetricStrip(a.s)}<div class="table-wrap"><table><thead><tr><th>Ad / center</th><th>Why review</th><th>Spend</th><th>Results / CPR</th><th>Leads / CPL</th><th>Booking / CPB</th></tr></thead><tbody>${priorityRows(a.members,'ads')}</tbody></table></div>`;
  $('detailDialog').showModal();
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.priorityTab){priorityTab=b.dataset.priorityTab;priorityShowAll=false;render();}else if(b.dataset.priorityAll){priorityShowAll=!priorityShowAll;render();}else if(b.dataset.prioritySet!==undefined)reviewPrioritySet(Number(b.dataset.prioritySet));});
