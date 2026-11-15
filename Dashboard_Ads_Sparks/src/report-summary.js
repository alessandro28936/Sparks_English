/* Recover outcomes only at their proven report scope; never allocate them to ads. */
const ReportSummary=(()=>{
  const owner=r=>JSON.stringify([r.center,r.brand,r.account,r.campaign,r.adset]);
  const rawKey=r=>r.raw?.['Report Key']||[r.brand,r.day,r.raw?.['Ad set trim']||r.adset,r.adCode].join('|');
  function index(source,reports){
    const groups=new Map();
    for(const r of source){const keys=[['legacy',rawKey(r)],['account',rawKey(r)+'|'+r.account]];
      if(r.raw?.['Account ID']&&r.raw?.['Ad ID'])keys.push(['id',[r.brand,r.day,r.raw['Account ID'],r.raw['Ad ID']].join('|')]);
      for(const [tier,key] of keys){const id=tier+'|'+key;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}
    }
    const buckets=[],seen=new Set();
    for(const report of reports){const id=report.tier+'|'+report.key;if(seen.has(id))continue;seen.add(id);
      const members=groups.get(id)||[];if(!members.length)continue;
      const owners=new Set(members.map(owner));
      buckets.push({...report,members,owners:owners.size,safe:owners.size===1});
    }
    buckets.sort((a,b)=>['id','account','legacy'].indexOf(a.tier)-['id','account','legacy'].indexOf(b.tier));
    return {buckets};
  }
  function records(english,slsa,scoped){
    const out=[];
    // User confirmed: a PRESENT report row with an empty outcome means zero.
    // An absent lookup key/report, or invalid numeric text, remains unknown.
    const outcome=v=>v==null||typeof v==='string'&&!v.trim()?0:A.num(v);
    for(const [brand,list,prefix] of [['English',english,''],['SLSA',slsa,'SLSA ']])for(const r of list){const key=r[prefix+'Lookup key'];if(key)out.push({tier:'legacy',key:brand+'|'+key,leads:outcome(r[prefix+'Leads']),booking:outcome(r[prefix+'Booking'])});}
    for(const r of scoped)for(const [tier,prefix] of [['account','Account'],['id','ID']])if(r[prefix+' report key'])out.push({tier,key:r[prefix+' report key'],leads:outcome(r[prefix+' Leads']),booking:outcome(r[prefix+' Booking'])});
    return out;
  }
  function aggregate(items,idx){
    const chosen=new Set(items),patches=new Map(),recovered=[],claimed={leads:new Set(),booking:new Set()};
    for(const b of idx?.buckets||[]){
      if(!b.safe||!b.members.every(r=>chosen.has(r)))continue;
      for(const metric of ['leads','booking']){
        if(!Number.isFinite(b[metric])||b.members.some(r=>Number.isFinite(r[metric])||claimed[metric].has(r)))continue;
        // Ephemeral aggregation contributions, never written to raw rows or ad recommendations.
        b.members.forEach((r,i)=>{patches.set(r,{...(patches.get(r)||{}),[metric]:i===0?b[metric]:0});claimed[metric].add(r);});
        recovered.push({key:b.key,metric,value:b[metric],rows:b.members.length,center:b.members[0].center,account:b.members[0].account,adset:b.members[0].adset});
      }
    }
    const result=A.aggregate(items.map(r=>patches.has(r)?{...r,...patches.get(r)}:r));
    return {...result,recovered};
  }
  return {index,records,aggregate,owner,rawKey};
})();
let reportSummaryIndex=null,reportSummaryError='';
// Add a rename only after the old Daily Report code has been verified.
const verifiedOutcomeAliases=[
  // Previously confirmed CBN rename, preserved unchanged.
  {brand:'English',account:'Main',center:'CBN',adset:'CBN_T_M_W_1/5/26',adId:'120249097142890027',oldCode:'IAFPC_10',start:'2026-10-23',end:'2026-11-08'},
  // 20 October: three report codes predate their current IAFBEOE_95 names.
  {brand:'English',account:'Main',center:'TMP',adset:'TMP_T_M_W_1/5/26',adId:'120249046668610027',oldCode:'IAFBEOE_98',start:'2026-10-20',end:'2026-10-20'},
  {brand:'English',account:'Main',center:'CBN',adset:'CBN_T_M_W_1/5/26',adId:'120249046417170027',oldCode:'IAFBEOE_96',start:'2026-10-20',end:'2026-10-20'},
  {brand:'English',account:'Main',center:'GLK',adset:'GLK_T_M_W_17/4/26',adId:'120249046440240027',oldCode:'IAFBEOE_97',start:'2026-10-20',end:'2026-10-20'},
  // 21 October: BTR source trim includes _OG but Daily Report did not.
  {brand:'English',account:'Main',center:'BTR',adset:'BTR_T_D_W_OG_21/10/26',adId:'120249061519580027',oldAdset:'BTR_T_D_W',start:'2026-10-21',end:'2026-10-21'},
  {brand:'English',account:'Main',center:'BTR',adset:'BTR_T_D_W_OG_21/10/26',adId:'120249061519540027',oldAdset:'BTR_T_D_W',start:'2026-10-21',end:'2026-10-21'},
  {brand:'English',account:'Main',center:'BTR',adset:'BTR_T_D_W_OG_21/10/26',adId:'120249061519560027',oldAdset:'BTR_T_D_W',start:'2026-10-21',end:'2026-10-21'},
  {brand:'English',account:'Main',center:'BTR',adset:'BTR_T_D_W_OG_21/10/26',adId:'120249061519530027',oldAdset:'BTR_T_D_W',start:'2026-10-21',end:'2026-10-21'},
  {brand:'English',account:'Main',center:'BTR',adset:'BTR_T_D_W_OG_21/10/26',adId:'120249061519590027',oldAdset:'BTR_T_D_W',start:'2026-10-21',end:'2026-10-21'},
];
function applyVerifiedOutcomeAliases(source,reports,aliases=verifiedOutcomeAliases){
  const output=[...reports],byKey=new Map(reports.map(r=>[r.tier+'|'+r.key,r])),seen=new Set(),claimedOldReports=new Set();
  for(const alias of aliases)for(const r of source){
    if(r.brand!==alias.brand||r.account!==alias.account||r.center!==alias.center||r.adset.replace(/\s/g,'')!==alias.adset.replace(/\s/g,'')||String(r.raw?.['Ad ID']||'')!==alias.adId||r.day<alias.start||r.day>alias.end)continue;
    const currentKey=ReportSummary.rawKey(r),parts=currentKey.split('|');
    if(alias.oldAdset)parts[parts.length-2]=alias.oldAdset;
    if(alias.oldCode)parts[parts.length-1]=alias.oldCode;
    const oldKey=parts.join('|');
    // Never reuse a historical report already owned by a source row.
    if(source.some(x=>ReportSummary.rawKey(x)===oldKey))continue;
    const oldReport=byKey.get('account|'+oldKey+'|'+r.account)||byKey.get('legacy|'+oldKey);
    const oldReportId=oldReport?.tier+'|'+oldReport?.key;
    const accountId=r.raw?.['Account ID'];if(!oldReport||!accountId||claimedOldReports.has(oldReportId))continue;
    // Check ownership in current source context: the reported ad-set trim may differ.
    const prefix=currentKey.split('|').slice(0,-1).join('|');
    const owners=new Set(source.filter(x=>ReportSummary.rawKey(x).split('|').slice(0,-1).join('|')===prefix&&(oldReport.tier!=='account'||x.account===r.account)).map(ReportSummary.owner));
    if(owners.size!==1)continue;
    const key=[r.brand,r.day,accountId,alias.adId].join('|');if(byKey.has('id|'+key)||seen.has(key))continue;
    // Actual current-name reports always take precedence over historical aliases.
    const current=byKey.get('account|'+currentKey+'|'+r.account)||byKey.get('legacy|'+currentKey);
    if(current)continue;
    output.push({tier:'id',key,leads:oldReport.leads,booking:oldReport.booking});
    claimedOldReports.add(oldReportId);seen.add(key);r.verifiedReportAlias=alias.oldCode||alias.oldAdset;
  }
  return output;
}
function fillUniqueOutcomeReports(source,idx){
  // A unique exact/scoped report may fill a missing value on its single ad.
  // A shared report must never be copied into each physical ad.
  for(const b of idx.buckets){
    if(!b.safe||b.members.length!==1)continue;
    const r=b.members[0];
    for(const k of ['leads','booking'])if(!Number.isFinite(r[k])&&Number.isFinite(b[k]))r[k]=b[k];
  }
  return source;
}
function excludeUnpublishedRows(source){
  const conflicts=new Set();
  const activity=r=>['spend','results','impressions','clicks','views','plays3','plays100','leads','booking'].some(k=>Number(r[k])>0);
  for(const r of source){const pub=Rules.published(r.ad);if(pub&&r.day<pub&&activity(r))conflicts.add(A.adIdentity(r));}
  for(const r of source){r.confirmedRenamed=Rules.confirmedRenamed(r);r.publishDateConflict=!r.confirmedRenamed&&conflicts.has(A.adIdentity(r))&&r.day<Rules.published(r.ad);}
  return source.filter(r=>{const pub=Rules.published(r.ad);return r.confirmedRenamed||!pub||r.day>=pub||activity(r)||conflicts.has(A.adIdentity(r));});
}
// Shared reports define a content group only within a uniquely proven owner and Results context.
function combineApprovedOutcomeAds(source,reports){
  const family=r=>JSON.stringify([ReportSummary.owner(r),r.adCode,A.metricContext(r)]);
  const idx=ReportSummary.index(source,reports),eligible=new Set();
  for(const b of idx.buckets){
    if(!b.safe||!b.members.length||new Set(b.members.map(family)).size!==1||new Set(b.members.map(A.adIdentity)).size<2)continue;
    const first=b.members[0];
    if(!first.adCode||!first.center||first.center==='Unknown'||!first.account||first.account==='Unknown')continue;
    if(['leads','booking'].some(k=>Number.isFinite(b[k])&&b.members.every(r=>!Number.isFinite(r[k]))))eligible.add(family(first));
  }
  // Keep the user's previously approved OLD_14 group even on days without a report.
  const approved=r=>r.brand==='English'&&r.account==='Secondary'&&r.center==='TBT'&&r.adset.replace(/\s/g,'')==='TBT_T_D_W_BA_13/3/26'&&['10/10/26 - OLD_14','4/11/26 - OLD_14'].includes(r.ad);
  const approvedRows=source.filter(approved);
  if(new Set(approvedRows.map(A.adIdentity)).size===2)approvedRows.forEach(r=>eligible.add(family(r)));
  const families=new Map(),groups=new Map(),out=[];
  for(const r of source){const f=family(r);if(!eligible.has(f)){out.push(r);continue;}
    if(!families.has(f))families.set(f,new Map());families.get(f).set(A.adIdentity(r),r);
    const key=JSON.stringify([f,r.day]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
  }
  for(const members of groups.values()){
    const first=members[0],s=ReportSummary.aggregate(members,idx),raw={...first.raw,'Spend Share':null,_format:{}};
    delete raw['Ad ID']; // Account ID remains valid for this owner; ad-level identity is collective.
    const originals=[...families.get(family(first)).values()],count=originals.length;
    const names=originals.map(r=>r.ad+(originals.filter(x=>x.ad===r.ad).length>1?' · Ad ID '+(r.raw?.['Ad ID']||r.adIdentityId||'unknown'):'')).sort();
    const statuses=new Set(members.map(r=>r.status));
    const combined={...first,raw,ad:first.adCode+' [Combined: '+count+' ads]',adIdentityId:undefined,combinedMembers:members,combinedNames:names,combinedCount:count,
      status:statuses.has('active')?'active':statuses.size===1?[...statuses][0]:'unknown',
      leads:s.leadRows===s.rows?s.leads:null,booking:s.bookingRows===s.rows?s.booking:null,frequency:s.frequency};
    for(const label of ['message','pillar'])combined[label]=members.every(r=>r[label]&&r[label]===first[label])?first[label]:'';
    for(const k of ['spend','results','impressions','clicks','views','plays3','plays100'])combined[k]=s[k];
    out.push(combined);
  }
  return out.sort((a,b)=>a.day.localeCompare(b.day));
}

function annotateReportIssues(source,idx){
  const found=new Map();
  for(const b of idx?.buckets||[])for(const r of b.members){
    if(!found.has(r))found.set(r,{});
    for(const k of ['leads','booking'])if(Number.isFinite(b[k])&&!found.get(r)[k])found.get(r)[k]=b.members.length>1?'ambiguous':'unmatched';
  }
  for(const r of source)r.reportIssue=Object.fromEntries(['leads','booking'].filter(k=>!Number.isFinite(r[k])).map(k=>[k,idx?(found.get(r)?.[k]||'missing'):'unmatched']));
}
function reportIssueLabel(s,key){
  if(s.items?.some(r=>r.confirmedRenamed))return 'Renamed ad - historical outcomes not matched';
  if(s.items?.some(r=>r.publishDateConflict))return 'Publish date conflict · verify report dates';
  const keys=key==='bookingRate'?['leads','booking'].filter(k=>s.coverage?.[k]?s.coverage[k].rows<s.coverage[k].totalRows:s[k==='leads'?'leadRows':'bookingRows']<s.rows):['booking','cpb'].includes(key)?['booking']:['leads'];
  const issues=keys.map(k=>s.reportIssues?.[k]||{}),missing=issues.some(i=>i.missing),ambiguous=issues.some(i=>i.ambiguous),unmatched=issues.some(i=>i.unmatched);
  if(ambiguous&&(missing||unmatched))return 'Missing reports + ambiguous matches';
  if(ambiguous)return 'Ambiguous ad match';
  if(unmatched)return missing?'Missing reports + unmatched rows':'Report not matched';
  return 'Missing '+keys.map(k=>k==='leads'?'Leads':'Booking').join('/');
}
function overviewReading(s,key){
  const coverage=s.coverage?.[key],partial=!!coverage&&coverage.rows<coverage.totalRows;
  const value=!s.rows?null:partial?s.observed?.[key]??null:s[key]??null;
  const base=key==='cpl'?`${money(coverage?.spend)} / ${integer(s.observed?.leads)} Leads`:key==='cpb'?`${money(coverage?.spend)} / ${integer(s.observed?.booking)} Booking`:key==='leadRate'?`${integer(s.observed?.leads)} Leads / ${integer(coverage?.results)} Results`:key==='bookingRate'?`${integer(coverage?.booking)} Booking / ${integer(coverage?.leads)} Leads`:'';
  const label=!partial?'':value===null?reportIssueLabel(s,key):['leads','booking'].includes(key)?'Recorded outcomes':'Matched data';
  const note=partial?`${label} · ${coverage.rows}/${coverage.totalRows} rows matched. ${base}. ${reportIssueLabel(s,key)}. Missing values are not zero.`:value===null?'No data or denominator is zero.':'';
  return {value,partial,coverage,label,note};
}
const resultContext=r=>A.metricContext(r);
const contextLabel=r=>[r.brand,A.analysisObjective(r),A.outcomeType(r)].join(' / ');
const contextSensitive=key=>['results','cpr','leadRate'].includes(key);
function overviewGroups(items,key){
  return contextSensitive(key)?A.group(items,resultContext).sort((a,b)=>b.spend-a.spend):[{items,key:'all'}];
}
function overviewPeriods(items,grain=chartGrain){return A.periodGroups(items,grain,$('startFilter').value,$('endFilter').value).map(p=>({...p,...summaryAggregate(p.items)}));}
function reportAuditPanel(){
  const missing=selected.filter(r=>!Number.isFinite(r.leads)||!Number.isFinite(r.booking));
  if(!missing.length)return '';
  const groups=A.group(missing,A.adIdentity);
  return `<details class="report-audit"><summary>Outcome matching issues · ${integer(groups.length)} ads · ${integer(missing.length)} daily rows</summary><p class="mini-note">Missing Leads/Booking: no matching outcome report was found. Ambiguous ad match: the report covers multiple possible ads. Report not matched: a report exists but its values have not reached the ad row, or report sync failed. Shared outcomes are counted once at ad-set level or in a content group within the same proven account, center and ad set; they are never copied to individual ads.</p><p class="mini-note">Check dates, account, ad set and creative in <a target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/${SHEET}/edit#gid=531288135">Copy of Daily Report</a>. Use Account ID + Ad ID when names collide. Enter 0 only after confirming no outcomes.</p><div class="table-wrap"><table><thead><tr><th>Account / ad set</th><th>Ad</th><th>Affected dates</th><th>Missing fields</th><th>Reason</th></tr></thead><tbody>${groups.slice(0,100).map(g=>{const r=g.items[0],ds=[...g.days].sort(),fields=[g.leadRows<g.rows?'Leads':'',g.bookingRows<g.rows?'Booking':''].filter(Boolean);return `<tr><td>${esc(r.account)}<small>${esc(r.adset)}</small></td><td>${esc(r.ad)}</td><td>${esc(ds[0])} – ${esc(ds.at(-1))}<small>${ds.length} days</small></td><td>${fields.join(' / ')}</td><td>${esc(reportIssueLabel(g,'bookingRate'))}</td></tr>`;}).join('')}</tbody></table></div>${groups.length>100?'<p class="mini-note">First 100 ads shown. Narrow the center, campaign or search filter to inspect the remaining ads.</p>':''}</details>`;
}
function summaryAggregate(items){return ReportSummary.aggregate(items,reportSummaryIndex);}
function centerSummaryMetricStrip(s){
  return `<div class="meeting-metrics center-summary-metrics">${[['results','Results'],['leads','Leads'],['booking','Booking'],['cpr','CPR'],['cpl','CPL'],['cpb','CPB'],['bookingRate','Leads &rarr; Booking (%)']].map(([key,label])=>{
    const reading=overviewReading(s,key),format=key==='bookingRate'?percent:key.startsWith('cp')?money:integer;
    const note=reading.note||(s.mixed&&key==='cpr'?'Different Results contexts; choose one to compare CPR.':'');
    return `<span data-center-metric="${key}" title="${esc(note)}"><small>${label}</small><b>${reading.partial?format(reading.value):metricTargetMarkup(reading.value,key,format(reading.value))}</b>${reading.partial?`<small class="summary-basis">${reading.label}</small>`:s.mixed&&key==='cpr'?'<small class="summary-basis">Mixed Results</small>':''}</span>`;
  }).join('')}</div>`;
}
function centerSummaryCoverage(s){
  const partial=['leads','booking'].some(k=>s.coverage[k].rows<s.rows);
  if(!partial&&!s.recovered?.length)return '';
  return `<details class="center-report-coverage"><summary>Report coverage</summary><div>${['cpl','cpb','bookingRate'].map(key=>{
    const c=s.coverage[key],basis=key==='cpl'?`${money(c.spend)} / ${integer(s.observed.leads)} Leads`:key==='cpb'?`${money(c.spend)} / ${integer(s.observed.booking)} Booking`:`${integer(c.booking)} Booking / ${integer(c.leads)} Leads`;
    return `<p><b>${key==='bookingRate'?'Leads &rarr; Booking':key.toUpperCase()}</b> &middot; ${c.rows}/${c.totalRows} rows<br>${basis}${c.rows?`<br>${esc(prettyDate(c.start))} &ndash; ${esc(prettyDate(c.end))}`:''}</p>`;
  }).join('')}${s.recovered?.length?'<p>Shared outcomes counted once at their matched ad-set scope.</p>':''}${partial?'<p>Only matched rows are used for these ratios. Missing outcomes are not zero; these values are not full-period costs.</p>':''}</div></details>`;
}
function summaryMetric(s,key,format){
  const c=s.coverage?.[key],partial=!!c&&c.rows<c.totalRows;
  const value=partial?s.observed?.[key]??null:s[key]??null;
  if(!partial)return {value,html:metricTargetMarkup(value,key,format(value)),note:''};
  const base=key==='cpl'?`${money(c.spend)} / ${integer(s.observed.leads)} Leads`:key==='cpb'?`${money(c.spend)} / ${integer(s.observed.booking)} Booking`:key==='leadRate'?`${integer(s.observed.leads)} Leads / ${integer(c.results)} Results`:key==='bookingRate'?`${integer(c.booking)} Booking / ${integer(c.leads)} Leads`:'';
  return {value,html:`${format(value)}<small class="summary-basis">${value===null?'Awaiting matched data':'Matched data'}</small>`,note:`${esc(base)}${base?' · ':''}${c.rows}/${c.totalRows} rows matched`};
}
function resultTypeSummary(items,key){
  const groups=A.group(items,resultContext).sort((a,b)=>b.spend-a.spend);
  const values=groups.map(g=>{const s=summaryAggregate(g.items),r=g.items[0],m=summaryMetric(s,key,key==='cpr'?money:percent);return `<div class="summary-result-type"><b>${m.html}</b><small>${esc(contextLabel(r))}${m.note?'<br>'+m.note:''}</small></div>`;});
  return `<div class="summary-result-types">${values.slice(0,2).join('')}${values.length>2?`<details><summary>${values.length-2} more result types</summary>${values.slice(2).join('')}</details>`:''}</div>`;
}
function summaryCoveragePanel(s){const recovered=s.recovered||[],groups=new Map();for(const r of recovered){const key=JSON.stringify([r.center,r.account,r.adset]);if(!groups.has(key))groups.set(key,{...r,leads:0,booking:0});groups.get(key)[r.metric]+=r.value;}return `<details class="summary-coverage"><summary>Summary data coverage · ${s.leadRows}/${s.rows} rows matched${groups.size?' · '+groups.size+' ad sets include shared-creative outcomes':''}</summary><p>Summary mencocokkan tanggal, brand, center, ad set, account yang dapat dibuktikan, dan kode creative. Hasil yang diketahui pada tingkat ad set dihitung satu kali jika seluruh ad terkait ada dalam filter. Hasil tersebut tidak dibagikan atau disalin ke masing-masing ad.</p><p>Matched data berarti rasio hanya memakai spend dan hasil yang cocok pada baris yang sama; pembilang dan penyebut ditampilkan pada kartu. Ini bukan rasio seluruh periode jika laporan belum lengkap. CPR dan Results → Leads dengan jenis Results berbeda ditampilkan terpisah.</p>${reportSummaryError?`<p class="red-text">${esc(reportSummaryError)}</p>`:''}${groups.size?`<div class="table-wrap"><table><thead><tr><th>Center</th><th>Account</th><th>Ad set</th><th class="num">Additional Leads at ad-set level</th><th class="num">Additional Booking at ad-set level</th></tr></thead><tbody>${[...groups.values()].map(g=>`<tr><td>${esc(g.center)}</td><td>${esc(g.account)}</td><td>${esc(g.adset)}</td><td class="num">${integer(g.leads)}</td><td class="num">${integer(g.booking)}</td></tr>`).join('')}</tbody></table></div>`:''}</details>`;}
