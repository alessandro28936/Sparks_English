/* One business-target policy for costs. Relative rank is not a failure classification. */
const CostTargets=(()=>{
  const defaults={cpr:30000,cpl:40000,cpb:300000};
  const fields={cpr:'target',cpl:'cplTarget',cpb:'cpbTarget'};
  const limit=(key,settings={})=>key==='cpb'?300000:fields[key]?(Number.isFinite(settings[fields[key]])&&settings[fields[key]]>0?settings[fields[key]]:defaults[key]):null;
  const cpbTier=value=>!Number.isFinite(value)||value<0?'neutral':value<=300000?'good':value<=400000?'warning':value<=500000?'review':'bad';
  const cpbLabel=value=>({neutral:'No data',good:'Safe',warning:'Warning',review:'Review',bad:'Above kill threshold'})[cpbTier(value)];
  const meets=(value,key,settings)=>Number.isFinite(value)&&value>=0&&value<=limit(key,settings);
  const allMet=(s,settings)=>s.rows>0&&s.leadRows===s.rows&&s.bookingRows===s.rows&&!s.mixed&&Object.keys(defaults).every(k=>meets(s[k],k,settings));
  function benchmark(source,own,key,settings){
    const first=own[0],outcome={cpr:'results',cpl:'leads',cpb:'booking'}[key];
    if(!first||!outcome)return {ready:false,cost:null,spend:0,count:0,ads:0,items:[]};
    const ids=new Set(own.map(A.adIdentity));
    const comparable=source.filter(r=>r.center===first.center&&A.sameMetricContext(r,first)&&!ids.has(A.adIdentity(r)));
    // Use complete peer ads in the caller's period/account scope. Do not cherry-pick their reported days.
    const groups=A.group(comparable,A.adIdentity).filter(g=>g.items.every(r=>Number.isFinite(r[outcome])&&r[outcome]>=0&&Number.isFinite(r.spend)&&r.spend>=0));
    const items=groups.flatMap(g=>g.items),spend=items.reduce((s,r)=>s+r.spend,0),count=items.reduce((s,r)=>s+r[outcome],0);
    const ready=spend>=settings.minSpend&&count>=settings.minResults;
    return {ready,cost:ready?spend/count:null,spend,count,ads:groups.length,items};
  }
  const qualifies=(value,key,settings,reference)=>meets(value,key,settings)||Number.isFinite(value)&&reference?.ready&&value<=reference.cost;
  return {cpbTier,cpbLabel,defaults,limit,meets,allMet,benchmark,qualifies};
})();
function costTargetsMethodology(){return `<section class="card method"><h3>Cost targets & ranking</h3><p>CPR &le; ${money(CostTargets.limit('cpr',config))}; CPL &le; ${money(CostTargets.limit('cpl',config))}; CPB &le; ${money(CostTargets.limit('cpb',config))}. CPR and CPL are adjustable in Settings. CPB uses fixed tiers: safe ≤Rp300,000; warning >Rp300,000–Rp400,000; review >Rp400,000–Rp500,000; above Rp500,000 meets the CPB kill threshold. Colors show these tiers; action eligibility is evaluated separately. A qualified center average is a second eligibility path, but never changes the target/tier color.</p><p>Top 5: selected CPL/CPB meets its target OR is at or below a qualified center average, with minimum spend and outcome count. Worst 5: above both target and center average, or confirmed zero outcomes after minimum spend. If no center average is available, use the target and disclose the missing comparison. Top can be sorted by lowest cost or most Leads/Booking; Worst sorts by zero outcomes then highest cost. If all content meets target, Worst is empty. Missing data is not zero. Incomplete ratios are not ranked or colored as meeting target.</p><p>Content rankings use the selected period. Action statuses use the last seven days and retain delivery, age, data completeness and Results-to-Leads checks. Meeting iteration accepts enough outcomes within target or the qualified center average. Center average = peer Spend / peer outcomes, excluding the candidate and incomplete peer ads, within the same center, brand, Results context, period and account/filter scope. Search and key-message filters do not narrow the benchmark. Both CPL and CPB categories are evaluated independently. CPB above Rp500,000 triggers a kill recommendation for active ads with complete Booking and minimum spend in the seven-day action window, regardless of the center average. Selected-period content rankings remain relative learning lists, not delivery decisions. Period-change colors still describe improvement/decline against the previous period.</p></section>`;}
