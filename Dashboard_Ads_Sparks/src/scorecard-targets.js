/* Monthly planning targets are distinct from operational action thresholds. */
const ScorecardTargets=(()=>{
  const storage='sparks-scorecard-targets-v1',fields=['spend','results','leads','booking'];
  let plans={};try{plans=JSON.parse(localStorage.getItem(storage)||'{}')||{};}catch{}
  const valid=p=>p&&fields.every(k=>p[k]===null||Number.isFinite(p[k])&&p[k]>=0&&(k==='spend'?p[k]<=Number.MAX_SAFE_INTEGER/100&&Math.abs(p[k]*100-Math.round(p[k]*100))<0.01:Number.isSafeInteger(p[k])));
  function scopeKey(){return JSON.stringify([scope,workView,...['centerFilter','accountFilter','campaignFilter','objectiveFilter','resultFilter','roleFilter','messageFilter','searchFilter'].map(id=>$(id).value),scorecardContext]);}
  const key=(brand,month,scope)=>JSON.stringify([brand,month,scope]);
  function readStore(){const data=JSON.parse(localStorage.getItem(storage)||'{}');if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Saved targets cannot be read. Existing data has not been changed.');return data;}
  function save(brand,month,scope,p,expected){if(!['English','SLSA'].includes(brand)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!valid(p))throw Error('Check the month and non-negative numeric targets.');const latest=readStore(),id=key(brand,month,scope);if(expected!==undefined&&JSON.stringify(latest[id]||null)!==JSON.stringify(expected))throw Error('This plan changed in another tab. Reopen Targets to load it.');const next={...latest,[id]:p};localStorage.setItem(storage,JSON.stringify(next));plans=next;}
  function target(days,metric,brand,scope,source=plans){
    if(!['English','SLSA'].includes(brand)||!days.length)return null;
    const needed={cpr:['spend','results'],cpl:['spend','leads'],cpb:['spend','booking'],leadRate:['leads','results'],bookingRate:['booking','leads']}[metric]||[metric];
    const sum=Object.fromEntries(needed.map(k=>[k,0]));
    for(const day of days){const p=source[key(brand,day.slice(0,7),scope)],d=new Date(day+'T00:00:00Z'),n=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();if(!valid(p)||needed.some(k=>!Number.isFinite(p[k])))return null;for(const k of needed)sum[k]+=p[k]/n;}
    return needed.length===1?sum[metric]:A.ratio(sum[needed[0]],sum[needed[1]],MetricScorecards.rates.has(metric)?100:1);
  }
  function achievement(s,metric,target,completeDays=true){
    const r=MetricScorecards.read(s,metric);if(!completeDays||r.partial||!Number.isFinite(target)||target<=0||!s.rows)return null;
    if(metric.startsWith('cp')){
      const count=s[{cpr:'results',cpl:'leads',cpb:'booking'}[metric]];
      if(!s.mixed&&s.spend>0&&count===0)return 0;
      return r.value>0?target/r.value*100:null;
    }
    return Number.isFinite(r.value)?r.value/target*100:null;
  }
  function get(brand,month,scope){plans=readStore();return plans[key(brand,month,scope)];}
  function otherScopes(brand,month,scope){return Object.keys(readStore()).filter(k=>{try{const [b,m,s]=JSON.parse(k);return b===brand&&m===month&&s!==scope;}catch{return false;}}).length;}
  return {fields,valid,key,scopeKey,save,target,achievement,get,otherScopes};
})();
function scorecardTargetRows(weeks,metric){
  const brand=$('brandFilter').value,scope=ScorecardTargets.scopeKey();
  const entries=weeks.map(w=>{const cells=w.cells.filter(c=>c.included),target=ScorecardTargets.target(cells.map(c=>c.day),metric,brand,scope);return {target,ach:ScorecardTargets.achievement(w.s,metric,target,cells.every(c=>c.items.length))};});
  return `<tr class="sc-week-target"><th scope="row">Week target</th>${entries.map(x=>`<td class="num" title="Monthly plan prorated by calendar days; uses this brand and exact filter scope">${x.target===null?'<small>Not set</small>':scorecardFormat(x.target,metric)}</td>`).join('')}<td colspan="2"></td></tr><tr class="sc-achievement"><th scope="row">Ach%</th>${entries.map(x=>`<td class="num ${x.ach===null?'':metric==='spend'?(x.ach>100?'sc-bad':'sc-neutral'):x.ach>=100?'sc-good':'sc-bad'}" title="${metric==='spend'?'Budget used: Spend / budget. Below 100% is not a performance success.':metric.startsWith('cp')?'Target cost / actual cost × 100%. Lower costs are better.':'Actual / target × 100%.'}"><b>${percent(x.ach)}</b></td>`).join('')}<td colspan="2"></td></tr>`;
}
const TargetNumber=(()=>{
  function parse(text,kind){
    let s=String(text).trim().replace(/^Rp\s*/i,'').trim();
    if(!s)return {value:null};
    if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s))return {error:'Use 8.000.000 or 8000000'+(kind==='spend'?'; decimals use a comma.':'.')};
    if(kind!=='spend'&&s.includes(','))return {error:'Use a whole number.'};
    const value=Number(s.replace(/\./g,'').replace(',','.'));
    if(!Number.isFinite(value)||value<0||value>(kind==='spend'?Number.MAX_SAFE_INTEGER/100:Number.MAX_SAFE_INTEGER))return {error:'This number is too large.'};
    return {value};
  }
  const format=value=>value==null?'':new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(value);
  function input(el,event){
    const caret=el.selectionStart??el.value.length,raw=el.value;
    // Group digit edits, but validate pasted text before removing any separators.
    const typing=event?.inputType==='insertText'||event?.inputType?.startsWith('delete');
    const candidate=typing&&/^[\d.,]*$/.test(raw)?raw.replace(/\./g,''):raw;
    const result=parse(candidate,el.dataset.numberKind);
    if(result.error)return result;
    const tokens=raw.slice(0,caret).replace(/[^\d,]/g,'').length;
    const cleaned=candidate.trim().replace(/^Rp\s*/i,'').replace(/\./g,'');
    const parts=cleaned.split(',');
    el.value=result.value===null?'':format(Number(parts[0]))+(parts.length>1?','+parts[1]:'');
    let position=0,n=0;while(position<el.value.length&&n<tokens){if(/[\d,]/.test(el.value[position]))n++;position++;}
    el.setSelectionRange(position,position);
    return result;
  }
  return {parse,format,input};
})();
function openScorecardTargets(){
  let dialog=$('scorecardTargetsDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='scorecardTargetsDialog';document.body.append(dialog);}
  dialog.setAttribute('aria-labelledby','targetDialogTitle');
  const planScope=ScorecardTargets.scopeKey(),initialBrand=$('brandFilter').value==='SLSA'?'SLSA':'English';
  const initialMonth=($('endFilter').value||latestSourceDay()||jakartaDay()).slice(0,7);
  const brief=[$('centerFilter').selectedOptions[0]?.textContent,$('accountFilter').selectedOptions[0]?.textContent].join(' · ');
  const scopeEntries=[['Assignments',scopeLabel()],['Workspace',workView==='preheat'?'Canvas':workView],...['centerFilter','accountFilter','campaignFilter','objectiveFilter','resultFilter','roleFilter','messageFilter'].map(id=>[$(id).closest('label')?.childNodes[0]?.textContent.trim()||id,$(id).selectedOptions[0]?.textContent]),['Search',$('searchFilter').value||'None'],['Results context',scorecardContext==='ALL'?'All contexts':scorecardContext]];
  dialog.innerHTML=`<form id="scorecardTargetsForm" novalidate><header class="target-header"><div><h2 id="targetDialogTitle">Monthly targets</h2><span class="target-local">Saved in this browser</span></div><button type="button" class="icon-button" data-target-close aria-label="Close targets">×</button></header><div class="target-body"><div class="target-grid target-selectors"><label>Brand<select id="planBrand"><option value="English">Sparks English</option><option value="SLSA">Sparks Leadership Speech Academy</option></select></label><label>Month<input id="planMonth" type="month" required></label></div><details class="target-scope-compact"><summary>${esc(brief)} <span>View filters</span></summary><dl>${scopeEntries.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></details><p id="planScopeNotice" class="target-state" role="status"></p><div class="target-grid target-numbers">${[['spend','Budget'],['results','Results'],['leads','Leads'],['booking','Booking']].map(([k,label])=>`<label for="plan_${k}">${label}${k==='spend'?' <span class="target-unit">IDR / month</span>':' <span class="target-unit">/ month</span>'}<input id="plan_${k}" type="text" inputmode="${k==='spend'?'decimal':'numeric'}" data-number-kind="${k}" autocomplete="off" spellcheck="false" placeholder="Not set" aria-describedby="plan_${k}_error"><small id="plan_${k}_error" class="target-field-error"></small></label>`).join('')}</div><div id="planDerived" class="target-derived"></div><p id="planWarning" class="target-warning" role="status"></p><details class="target-help"><summary>Calculation details</summary><p>Week target = monthly plan ÷ days in month × selected days. A week spanning two months uses both plans. Outcomes: actual ÷ target. Costs: target ÷ actual. Spend: budget used. Blank means not set; a zero target has no Ach%. These targets do not change ad action rules.</p><p>Plans belong to the brand, month and filters shown above. Choose matching filters to view a saved plan.</p></details><p id="planError" role="alert" class="target-field-error"></p></div><div id="planPending" class="target-pending" hidden><b>Unsaved changes</b><span>Save or discard before continuing.</span><div><button type="button" id="planKeep" class="text-button">Keep editing</button><button type="button" id="planDiscard" class="button secondary">Discard</button><button type="button" id="planSaveContinue" class="button primary">Save & continue</button></div></div><footer class="target-footer"><span id="planStatus" role="status">No changes</span><div><button type="button" class="button secondary" data-target-close>Cancel</button><button type="submit" id="planSave" class="button primary">Save targets</button></div></footer></form>`;
  let active={brand:initialBrand,month:initialMonth},original=null,snapshot='',pending=null,loadError=false;
  const strings=()=>JSON.stringify(ScorecardTargets.fields.map(k=>$('plan_'+k).value));
  const dirty=()=>strings()!==snapshot;
  const read=()=>{const p={};let first=null;for(const k of ScorecardTargets.fields){const el=$('plan_'+k),r=TargetNumber.parse(el.value,k);$('plan_'+k+'_error').textContent=r.error||'';el.setAttribute('aria-invalid',String(!!r.error));if(r.error&&!first)first=el;p[k]=r.value??null;}return {p,first};};
  const preview=()=>{
    const {p,first}=read(),ratio=(a,b,factor=1)=>first||p[a]===null||p[b]===null?null:A.ratio(p[a],p[b],factor);
    const ratios=[['CPR',ratio('spend','results')],['CPL',ratio('spend','leads')],['CPB',ratio('spend','booking')],['Results → Leads',ratio('leads','results',100)],['Leads → Booking',ratio('booking','leads',100)]];
    $('planDerived').innerHTML='<b>Calculated targets</b><div>'+ratios.map(([k,v])=>`<span>${k}<strong>${v===null?'—':k.startsWith('CP')?money(v):percent(v)}</strong></span>`).join('')+'</div>';
    const warnings=[];if(!first&&p.leads!==null&&p.results!==null&&p.leads>p.results)warnings.push('Leads exceed Results.');if(!first&&p.booking!==null&&p.leads!==null&&p.booking>p.leads)warnings.push('Booking exceeds Leads.');
    $('planWarning').textContent=warnings.length?warnings.join(' ')+' Check your plan.':'';
    $('planStatus').textContent=dirty()?'Unsaved changes':original?'Saved plan':'New plan';$('planSave').disabled=!!first||loadError||!dirty();
  };
  const load=()=>{
    $('planBrand').value=active.brand;$('planMonth').value=active.month;$('planError').textContent='';$('planScopeNotice').textContent='';loadError=false;
    try{original=ScorecardTargets.get(active.brand,active.month,planScope)||null;if(original&&!ScorecardTargets.valid(original))throw Error('This saved plan contains invalid numbers. Existing data has not been changed.');const others=ScorecardTargets.otherScopes(active.brand,active.month,planScope);$('planScopeNotice').textContent=!original&&others?`${others} saved plan(s) use different filters. No target is applied to this selection.`:'';}catch(err){loadError=true;original=null;$('planError').textContent='Unable to load targets. '+err.message;}
    for(const k of ScorecardTargets.fields)$('plan_'+k).value=TargetNumber.format(original?.[k]);snapshot=strings();preview();
  };
  const save=()=>{
    const {p,first}=read();if(first){first.focus();return false;}if(loadError)return false;
    try{ScorecardTargets.save(active.brand,active.month,planScope,p,original);original=p;snapshot=strings();preview();return true;}catch(err){$('planError').textContent='Could not save. '+err.message;return false;}
  };
  const finish=action=>{pending=null;$('planPending').hidden=true;if(action.close){dialog.close();refreshScorecards();document.querySelector('[data-scorecard-targets]')?.focus({preventScroll:true});}else{active=action;load();}};
  const request=action=>{if(dirty()) {pending=action;$('planPending').hidden=false;$('planBrand').value=active.brand;$('planMonth').value=active.month;$('planKeep').focus();}else finish(action);};
  const changeSelection=()=>{const next={brand:$('planBrand').value,month:$('planMonth').value};if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(next.month)){$('planMonth').value=active.month;$('planError').textContent='Choose a valid month.';return;}request(next);};
  $('planBrand').onchange=changeSelection;$('planMonth').onchange=changeSelection;
  for(const k of ScorecardTargets.fields){const el=$('plan_'+k);el.oninput=e=>{TargetNumber.input(el,e);$('planError').textContent='';preview();};el.onblur=()=>{const r=TargetNumber.parse(el.value,k);if(!r.error){el.value=TargetNumber.format(r.value);preview();}};}
  dialog.querySelectorAll('[data-target-close]').forEach(b=>b.onclick=()=>request({close:true}));dialog.oncancel=e=>{e.preventDefault();request({close:true});};
  $('planKeep').onclick=()=>{pending=null;$('planPending').hidden=true;$('plan_spend').focus();};
  $('planDiscard').onclick=()=>{if(pending)finish(pending);};$('planSaveContinue').onclick=()=>{if(pending&&save())finish(pending);};
  $('scorecardTargetsForm').onsubmit=e=>{e.preventDefault();if(pending){if(save())finish(pending);return;}if(save()){const label=active.brand==='SLSA'?'SLSA':'Sparks English';finish({close:true});notify(`Saved: ${label} · ${active.month}`+($('brandFilter').value!==active.brand?`. Select ${label} to view.`:''));}};
  dialog.onclose=()=>{pending=null;};dialog.targetIsDirty=dirty;
  load();dialog.showModal();$('plan_spend').focus();
}
document.addEventListener('click',e=>{if(e.target.closest('[data-scorecard-targets]'))openScorecardTargets();});
window.addEventListener('beforeunload',e=>{const d=$('scorecardTargetsDialog');if(d?.open&&d.targetIsDirty?.()){e.preventDefault();e.returnValue='';}});
