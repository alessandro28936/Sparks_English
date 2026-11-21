/* Ad set totals and expandable ad rows share the current dashboard filters. */
let adsetMetric='cpr',adsetOrder='best',adsetDelivery='active',adsetDetails=[];
const expandedAdsets=new Set();
const ADSET_METRICS=[['cpr','CPR',true],['cpl','CPL',true],['cpb','CPB',true],['results','Results',false],['leads','Leads',false],['booking','Booking',false],['leadRate','Results → Leads (%)',false],['bookingRate','Leads → Booking (%)',false]];
const adsetIdentity=r=>JSON.stringify([r.brand,r.account,r.campaign,r.adset]);
function adsetDeliveryIndex(){
  const latest=new Map();
  for(const r of rows.filter(temporalFilter).flatMap(r=>r.combinedMembers?[r,...r.combinedMembers]:[r])){
    const key=Rules.identity(r),status=String(r.status||'').trim().toLowerCase(),prior=latest.get(key);
    if(!prior||r.day>prior.day)latest.set(key,{day:r.day,statuses:new Set([status])});
    else if(r.day===prior.day)prior.statuses.add(status);
  }
  return new Map([...latest].map(([key,value])=>[key,{day:value.day,status:value.statuses.size===1&&['active','inactive'].includes([...value.statuses][0])?[...value.statuses][0]:'unknown'}]));
}
function adsetDeliveryLabel(ad){
  const status=ad.deliveryState,label=status==='active'?'Active':status==='inactive'?'Inactive':'Unknown status';
  return `<span class="ad-delivery-label">${label}<span class="sr-only"> as of ${esc(ad.deliveryDate)}</span></span>`;
}
function adsetRankingValue(g,key){
  const reading=metricDisplayData(g,key);
  if(g.mixed||g.resultType==='Tidak tercatat'||g.spend<config.minSpend||reading.partial)return null;
  if(Number.isFinite(reading.value))return reading.value;
  const count={cpr:'results',cpl:'leads',cpb:'booking'}[key];
  // Paid delivery with a complete, recorded zero outcome is worst, never Rp0.
  return count&&g[count]===0&&g.spend>0?Infinity:null;
}
function adsetPerformanceData(){
  const metric=ADSET_METRICS.find(m=>m[0]===adsetMetric)||ADSET_METRICS[0],lower=metric[2];
  const deliveryIndex=adsetDeliveryIndex(),capacity=new Map();
  for(const r of base.flatMap(r=>r.combinedMembers||[r])){const key=adsetIdentity(r);if(!capacity.has(key))capacity.set(key,new Set());if(deliveryIndex.get(Rules.identity(r))?.status==='active')capacity.get(key).add(Rules.identity(r));}
  const children=new Map(),spendBySet=new Map();
  const from=$('startFilter').value,to=$('endFilter').value;
  for(const r of rows){
    if(!r.day||(from&&r.day<from)||(to&&r.day>to))continue;
    const key=adsetIdentity(r);spendBySet.set(key,(spendBySet.get(key)||0)+r.spend);
  }
  for(const ad of creatives){const key=adsetIdentity(ad);if(!children.has(key))children.set(key,[]);children.get(key).push(ad);}
  adsetDetails=[];
  const groups=A.group(selected,adsetIdentity).map(g=>{
    const first=g.items[0];
    const allAds=A.group(g.items,Rules.identity).map(a=>{
      const r=a.items[0],original=(children.get(g.key)||[]).find(c=>Rules.identity(c)===a.key);
      const resultType=a.types.size===1?[...a.types][0]:original.resultType;
      const id='adset_ad_'+adsetDetails.length;
      let merged;
      if(original.items.length===a.items.length&&original.resultType===resultType&&original.start===from&&original.end===to){
        merged={...original,...a,id};
      }else{
        const context=A.metricContext({...r,resultType});
        const peers=base.filter(p=>p.center===r.center&&p.format===r.format&&A.metricContext(p)===context&&Rules.identity(p)!==a.key);
        merged=applyRules({...original,...a,id,resultType,benchmark:A.aggregate(peers),share:A.ratio(a.spend,spendBySet.get(g.key),100),start:from,end:to},peers);
      }
      const delivery=deliveryIndex.get(a.key)||{status:'unknown',day:''};
      merged.deliveryState=delivery.status;merged.deliveryDate=delivery.day;merged.lastDelivery=delivery.status;
      adsetDetails.push(merged);return merged;
    });
    const ads=allAds.filter(a=>adsetDelivery==='all'||a.deliveryState===adsetDelivery);
    if(!ads.length)return null;
    const items=ads.flatMap(a=>a.items),stats=summaryAggregate(items),resultType=stats.types.size===1?[...stats.types][0]:'Tidak tercatat';
    const ages=ads.map(a=>a.history.ageDays).filter(Number.isFinite);
    const item={...g,...stats,items,center:first.center,brand:first.brand,account:first.account,campaign:first.campaign,adset:first.adset,objective:first.objective,resultType,ads,ages,activeCount:capacity.get(g.key)?.size||0,context:A.metricContext({...first,resultType})};
    item.rankingValue=adsetRankingValue(item,metric[0]);return item;
  }).filter(Boolean);
  const compare=(a,b)=>a===b?0:(a<b?-1:1)*(lower?1:-1);
  for(const g of groups){
    const peers=groups.filter(p=>p.context===g.context&&p.rankingValue!==null);
    g.rank=g.rankingValue===null?null:1+peers.filter(p=>compare(p.rankingValue,g.rankingValue)<0).length;
    g.rankedCount=peers.length;
    g.isWorst=g.rank!==null&&peers.length>1&&peers.some(p=>compare(p.rankingValue,g.rankingValue)<0)&&!peers.some(p=>compare(p.rankingValue,g.rankingValue)>0);
  }
  return groups.sort((a,b)=>{
    if((a.rankingValue===null)!==(b.rankingValue===null))return a.rankingValue===null?1:-1;
    if(a.rankingValue!==null){const order=compare(a.rankingValue,b.rankingValue);if(order)return adsetOrder==='best'?order:-order;}
    return b.spend-a.spend||a.adset.localeCompare(b.adset);
  });
}
function adsetAge(g){
  if(!g.ages.length)return '—';
  const lo=Math.min(...g.ages),hi=Math.max(...g.ages);
  return `${lo===hi?lo:lo+'–'+hi} days${g.ages.length<g.ads.length?'*':''}`;
}
function adsetMetricCells(g,share,peers=[]){
  const comparable=peers.filter(p=>p!==g&&!p.mixed&&A.sameMetricContext(p,g)),benchmark=A.aggregate(comparable.flatMap(p=>p.items)),peerLabel=g.ads?'other center ad sets':'other ads in set';
  return [['spend',money],['share',percent],['results',integer],['leads',integer],['leadRate',percent],['cpr',money],['cpl',money],['booking',integer],['cpb',money],['bookingRate',percent]].map(([key,format])=>{
    const reading=key==='share'?{value:share}:metricDisplayData(g,key),value=reading.value,known=Number.isFinite(value)&&!reading.partial;
    let tone='',note='',strength=0,bar='';
    if(!known){
      const outcome={cpr:'results',cpl:'leads',cpb:'booking'}[key],count=outcome?metricDisplayData(g,outcome):null;
      tone='unknown';note=reading.partial?'':count&&!count.partial&&count.value===0?'No '+({results:'Results',leads:'Leads',booking:'Booking'}[outcome]):'No data';
    }
    else if(key==='bookingRate'){tone=CostTargets.bookingRateTier(value);strength=Math.min(1,Math.abs(value-20)/20);note=tone==='good'?'Meets 20%':tone==='warning'?'Below 20%':'Below 15%';}
    else if(key==='leadRate'||CostTargets.limit(key,config)){
      const target=key==='leadRate'?80:CostTargets.limit(key,config),good=key==='leadRate'?value>=target:value<=target;
      tone=key==='cpb'?CostTargets.cpbTier(value):good?'good':'bad';strength=Math.min(1,Math.abs(value-target)/target);
      note=key==='cpb'?CostTargets.cpbLabel(value):key==='leadRate'?(good?'Meets 80%':'Below 80%'):`${good?'Meets':'Above'} target ${money(target)}`;
    }
    if(known&&['results','leads','booking'].includes(key)){
      const max=Math.max(value,...peers.map(p=>metricDisplayData(p,key)).filter(r=>!r.partial&&Number.isFinite(r.value)).map(r=>r.value),1);
      bar=`<span class="adset-data-bar ${key}" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,value/max*100))}%"></i></span>`;
    }
    const title=key==='cpl'||key==='cpb'?`Target ${key.toUpperCase()}: ${money(CostTargets.limit(key,config))}. Context only: weighted ${key.toUpperCase()} of ${peerLabel}, same account, period, Delivery and filters. ${comparable.length?money(metricDisplayData(benchmark,key).value):'No benchmark'}`:key==='cpr'?`Target CPR: ${money(config.target)}`:key==='share'?(g.ads?'Share of selected spend':'Share of this ad set’s filtered spend'):note;
    return `<td class="num adset-reading ${tone}" data-adset-metric="${key}" style="--heat:${(.10+.19*strength).toFixed(3)}" title="${esc(title)}"><b>${key==='share'?percent(share):displayMetric(g,key,format)}</b>${note?`<small>${esc(note)}</small>`:''}${bar}</td>`;
  }).join('');
}
function renderAdsetPerformance(){
  const groups=adsetPerformanceData(),metric=ADSET_METRICS.find(m=>m[0]===adsetMetric)||ADSET_METRICS[0],total=groups.reduce((n,g)=>n+g.spend,0);
  const controls=`<div class="adset-controls"><label for="adsetDelivery">Delivery<select id="adsetDelivery">${[['active','Active ads'],['inactive','Inactive ads'],['all','All ads']].map(([key,label])=>`<option value="${key}" ${key===adsetDelivery?'selected':''}>${label}</option>`).join('')}</select></label><label for="adsetMetric">Rank by<select id="adsetMetric">${ADSET_METRICS.map(([key,label])=>`<option value="${key}" ${key===adsetMetric?'selected':''}>${label}</option>`).join('')}</select></label><label for="adsetOrder">Order<select id="adsetOrder"><option value="best" ${adsetOrder==='best'?'selected':''}>Best first</option><option value="worst" ${adsetOrder==='worst'?'selected':''}>Worst first</option></select></label></div>`;
  const heading=section('Ad set Performance',`Selected period: ${esc($('startFilter').value)} / ${esc($('endFilter').value)} | Actions: last 7 days`,controls);
  if(!groups.length)return heading+`<section class="card adset-performance">${empty('No '+(adsetDelivery==='all'?'matching':adsetDelivery)+' ads','Change Delivery or the date range to see other ads.')}</section>`;
  return heading+`<section class="card adset-performance"><div class="adset-legend"><span class="good">Meets target</span><span class="warning" title="CPB >Rp300,000–Rp400,000">CPB warning</span><span class="review" title="CPB >Rp400,000–Rp500,000">CPB review</span><span class="bad" title="CPB >Rp500,000; other metrics outside target">Outside limit</span><span>Gray: unavailable or no comparison</span></div><div class="table-wrap"><table><thead><tr><th>Ad set / ad name</th><th class="num" title="Active ads in this ad set, based on the latest recorded status in the selected period. Search and key-message filters do not reduce this capacity count. Maximum: 7 active ads.">Active ads</th><th>Rank · ${esc(metric[1])}</th><th class="num" title="Publish age of each ad; the parent row shows the youngest–oldest range.">Ad age</th>${['Spend','Spend share','Results','Leads','Results → Leads','CPR','CPL','Booking','CPB','Leads → Booking (%)'].map(k=>`<th class="num">${k}</th>`).join('')}</tr></thead><tbody>${groups.map(g=>{
    const open=expandedAdsets.has(g.key),rankText=g.rank===null?g.spend<config.minSpend?'Low spend':g.mixed?'Mixed Results':metricDisplayData(g,adsetMetric).partial?reportIssueLabel(g,adsetMetric):'No result denominator':`#${g.rank} / ${g.rankedCount}`;
    const costTarget=CostTargets.limit(adsetMetric,config),costKnown=costTarget&&g.rank!==null,aboveTarget=costKnown&&!CostTargets.meets(g.rankingValue,adsetMetric,config);
    const badge=costKnown?(!Number.isFinite(g.rankingValue)?'No '+({cpr:'Results',cpl:'Leads',cpb:'Booking'}[adsetMetric]):adsetMetric==='cpb'?CostTargets.cpbLabel(g.rankingValue):aboveTarget?'Above target':'Meets target'):g.rank===1&&g.rankedCount>1?'Highest '+metric[1]:g.isWorst?'Lowest '+metric[1]:'';
    return `<tr class="adset-parent"><td class="adset-name"><button class="adset-toggle" data-adset-toggle="${esc(g.key)}" aria-expanded="${open}"><span class="adset-chevron" aria-hidden="true">${open?'▾':'▸'}</span><span>${esc(g.adset)}</span></button><small>${esc(g.center)} · ${esc(g.brand)} ${accountBadge(g.account)}</small><small title="${esc(g.campaign)}">${esc(g.campaign)} · ${esc(g.resultType)}</small></td><td class="num"><span class="adset-count ${g.activeCount>7?'above-limit':g.activeCount<7?'below-limit':'at-limit'}">${integer(g.activeCount)}</span></td><td><b>${rankText}</b>${badge?`<small class="adset-rank ${costKnown?(adsetMetric==='cpb'?'cpb-'+CostTargets.cpbTier(g.rankingValue):aboveTarget?'worst':'best'):g.isWorst?'worst':'best'}">${esc(badge)}</small>`:''}</td><td class="num">${adsetAge(g)}</td>${adsetMetricCells(g,A.ratio(g.spend,total,100),groups.filter(p=>p.center===g.center&&p.account===g.account))}</tr>${open?g.ads.sort((a,b)=>(a.deliveryState==='active'?0:a.deliveryState==='inactive'?1:2)-(b.deliveryState==='active'?0:b.deliveryState==='inactive'?1:2)||b.spend-a.spend).map(a=>`<tr class="adset-child delivery-${a.deliveryState}"><td class="adset-name"><button class="ad-link" data-detail="${a.id}"><span class="ad-delivery-dot ${a.deliveryState}" aria-hidden="true"></span>${esc(a.ad)}</button>${A.identitySuffix(a).length?`<small>${esc(A.identitySuffix(a)[0])}</small>`:""}<small title="${esc('Last recorded status: '+a.deliveryDate)}">${adsetDeliveryLabel(a)} · ${esc(a.message||'Key message belum diisi')}</small></td><td class="num">&mdash;</td><td><details class="adset-action"><summary>${pill(a.state)}</summary>${actionStatus(a)}</details></td><td class="num" title="${esc('Published '+prettyDate(a.history.published)+'; as of '+prettyDate(a.history.asOf))}">${a.history.ageDays===null?'—':a.history.ageDays+' days'}</td>${adsetMetricCells(a,A.ratio(a.spend,g.spend,100),g.ads)}</tr>`).join(''):''}`;
  }).join('')}</tbody></table></div></section>`;
}

function adsetMethodology(){return `<section class="card method"><h3>Ad set comparisons</h3><p>Cell colors describe selected-period metrics, not kill decisions. CPR compares with the configured target; Results &rarr; Leads compares with 80%. CPB colors use the fixed safe/warning/review/kill-threshold tiers (300k/400k/500k). CPL compares its configured target. Safe cost targets (${money(CostTargets.limit('cpl',config))} and ${money(CostTargets.limit('cpb',config))}). Relative rank is not a failure label. Peer costs in tooltips are context only. Traffic and Leads messaging share the WhatsApp benchmark. Other outcomes and brands remain separate. Hover a cost cell for the benchmark. Bars compare child ads within their ad set and parent ad sets within their center/account. Totals, rankings and displayed ad ages follow Delivery. Parent ad-set totals may include shared-creative outcomes when every related ad is in view and the center/account/ad-set match is unique. Unattributed outcomes are never copied into child ad rows. Active ads counts include all active ads in each ad set under the date/account scope, before search and key-message filters. Status is the latest recorded value within the selected period, not a live Meta status. Unknown or conflicting statuses are available under All ads. Rankings compare the selected metric within the same brand, objective and Results type. Minimum spend: ${money(config.minSpend)}. Incomplete reports are shown without a rank. Paid delivery with zero Results, Leads or Booking sorts last for its corresponding cost. Ad age is measured through the latest available date in the selected period; * some publish dates are unknown. Ad set spend share uses spend in the selected Delivery view; ad rows use their ad set’s spend in that view.</p></section>`;}
