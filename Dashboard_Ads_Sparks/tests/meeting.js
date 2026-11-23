(() => {
  const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw new Error(name);};
  reset();navigate('overview');
  check('Iteration table moved out of overview',!document.querySelector('#iterationCandidates'));
  check('Meeting navigation exists',!!document.querySelector('nav [data-view=meeting]'));
  const normalized=A.normalize([{'Campaign name':'Traffic_WA_Main','Ad set name':'BHI_T_M_W','Ad name':'9/9/26 - V_TEST','Content Pillar':' Affordability Price ','Key Message Content':'Harga','Results':10}])[0];
  check('Content Pillar imported by header',normalized.pillar==='Affordability Price');
  navigate('meeting');
  meetingTab='briefing';render();
  check('The briefing starts with Worst CPL and Worst CPB and no ad table',
    [...document.querySelectorAll('.meeting-cost-panel h3')].map(h=>h.textContent).join('|')==='Worst CPL|Worst CPB'&&!$('viewContent').querySelector('table'));
  const rankingButton=document.querySelector('.meeting-cost-panel [data-meeting-center]');
  const initialCenter=$('centerFilter').value,initialStart=$('startFilter').value,initialEnd=$('endFilter').value;
  rankingButton.click();
  const popup=$('centerMapDialog');
  check('Ranked center uses the map summary',popup.open&&mapTab==='summary'&&mapFocus.code===rankingButton.dataset.meetingCenter);
  popup.querySelector('[data-map-tab="review"]').click();
  const reviewCount=creatives.filter(g=>mapCenterMatches(mapFocus,g)&&needsReview(g)).length;
  check('Review contains exactly the active ads flagged for this center',popup.querySelectorAll('.meeting-review-table tbody tr').length===reviewCount);
  popup.querySelector('[data-map-close]').click();
  check('Closing restores briefing without changing its analysis scope',
    !popup.open&&meetingTab==='briefing'&&$('centerFilter').value===initialCenter&&$('startFilter').value===initialStart&&$('endFilter').value===initialEnd);
  for(const tab of ['briefing','iterate','learning','bucket']){meetingTab=tab;render();check(tab+' renders content',document.querySelector('.meeting-tabs')&&$('viewContent').textContent.length>100);}
  const source=meetingAdSource(creatives.find(g=>g.results>=5&&meetingTargets({center:g.center,snapshot:{brand:g.brand,objective:g.objective,resultType:g.resultType,ad:g.ad,adset:g.adset,campaign:g.campaign}}).length));
  source.entityKey+='-qa-'+meetingId();source.title='QA meeting '+source.title;
  const baseCount=MeetingStore.read().items.length;
  meetingCompose(source,'iterate');const id=meetingDraft.id;
  const form=$('meetingForm');form.elements.task.value='Uji opening baru';meetingSave(form);
  check('New meeting item is persisted',MeetingStore.read().items.length===baseCount+1&&JSON.parse(localStorage.getItem(MeetingStore.key)).items.some(i=>i.id===id));
  const initial=MeetingStore.read().items.find(i=>i.id===id),snapshot=JSON.stringify(initial.snapshot);
  meetingCompose(source,'kill');check('Duplicate open entity opens existing item',meetingDraft.id===id);
  $('meetingForm').elements.stage.value='agreed';
  let blocked=false;try{meetingSave($('meetingForm'));}catch{blocked=true;}
  check('Agreed decision requires PIC and deadline',blocked&&MeetingStore.read().items.find(i=>i.id===id).stage==='discussion');
  $('meetingForm').elements.pic.value='QA marketer';$('meetingForm').elements.deadline.value=meetingToday();$('meetingForm').elements.note.value='Preserve original message';meetingSave($('meetingForm'));
  const updated=MeetingStore.read().items.find(i=>i.id===id);
  check('Decision history appends and snapshot stays frozen',updated.history.length===2&&JSON.stringify(updated.snapshot)===snapshot&&updated.stage==='agreed');
  meetingEdit(id);let f=$('meetingForm');f.elements.production.value='ready';meetingSave(f);
  check('Production complete does not invent evaluation',MeetingStore.read().items.find(i=>i.id===id).evaluations.length===0);
  meetingEdit(id);f=$('meetingForm');const target=meetingTargets(meetingDraft)[0];f.elements.targetKey.value=target.key;f.elements.evalStart.value=rows.map(r=>r.day).filter(Boolean).sort()[0];f.elements.evalEnd.value=rows.map(r=>r.day).filter(Boolean).sort().at(-1);f.elements.evaluationNote.value='Bandingkan biaya dan hasil per hari, belum bukti kausal.';f.elements.captureEvaluation.checked=true;meetingSave(f);
  const evaluated=MeetingStore.read().items.find(i=>i.id===id);
  check('Evaluation stores a separate target snapshot',evaluated.evaluations.length===1&&evaluated.evaluations[0].targetKey===target.key&&JSON.stringify(evaluated.snapshot)===snapshot);
  check('Source ad cannot be selected as its own iteration',!meetingTargets(initial).some(t=>t.ad===initial.snapshot.ad&&t.adset===initial.snapshot.adset&&t.campaign===initial.snapshot.campaign));
  check('Center without data does not show fabricated zeros',Object.values(meetingMetrics(A.aggregate([]))).every(v=>v===null));
  const setItem=Storage.prototype.setItem,beforeFailure=JSON.stringify(MeetingStore.read());let rejectedWrite=false;
  try{Storage.prototype.setItem=function(){throw new Error('QA storage full');};MeetingStore.save({...evaluated,note:'must not persist'});}catch{rejectedWrite=true;}finally{Storage.prototype.setItem=setItem;}
  check('Failed storage write does not claim success or mutate memory',rejectedWrite&&JSON.stringify(MeetingStore.read())===beforeFailure);
  const restore=MeetingStore.merge({schemaVersion:1,items:[initial]});
  check('Reimport never overwrites newer local decisions',restore.skipped===1&&MeetingStore.read().items.find(i=>i.id===id).evaluations.length===1);
  const before=JSON.stringify(MeetingStore.read());let invalid=false;try{MeetingStore.merge({schemaVersion:9,items:[]});}catch{invalid=true;}
  check('Malformed import rejected atomically',invalid&&JSON.stringify(MeetingStore.read())===before);
  const copy={...initial,id:meetingId(),entityKey:initial.entityKey+'copy',title:'QA imported copy'};const merged=MeetingStore.merge({schemaVersion:1,items:[copy]});check('Backup import adds independent IDs',merged.added===1);
  meetingTab='bucket';render();const originalConfirm=window.confirm;
  try{
    window.confirm=()=>false;document.querySelector(`[data-meeting-delete="${copy.id}"]`).click();
    check('Cancelling delete keeps item and history',MeetingStore.read().items.some(i=>i.id===copy.id));
    window.confirm=()=>true;
    try{Storage.prototype.setItem=function(){throw new Error('QA deletion storage failure');};document.querySelector(`[data-meeting-delete="${copy.id}"]`).click();}finally{Storage.prototype.setItem=setItem;}
    check('Failed deletion preserves saved item',MeetingStore.read().items.some(i=>i.id===copy.id)&&JSON.parse(localStorage.getItem(MeetingStore.key)).items.some(i=>i.id===copy.id));
    document.querySelector(`[data-meeting-delete="${copy.id}"]`).click();
    check('Confirmed delete removes only chosen item and persists',!MeetingStore.read().items.some(i=>i.id===copy.id)&&!JSON.parse(localStorage.getItem(MeetingStore.key)).items.some(i=>i.id===copy.id)&&MeetingStore.read().items.some(i=>i.id===id));
    check('Deleted card disappears from bucket',!document.querySelector(`[data-meeting-delete="${copy.id}"]`));
  }finally{window.confirm=originalConfirm;}
  navigate('centers');
  const metricNames=[...document.querySelectorAll('.center-card:first-child .meeting-metrics > span > small')].map(e=>e.textContent);
  check('Center Insights cards show the same seven meeting metrics',metricNames.join(',')==='Results,Leads,Booking,CPR,CPL,CPB,Leads → Booking (%)');
  const center=centersInScope()[0],stats=A.aggregate(selected.filter(r=>r.center===center));
  check('Center card metrics use filtered totals and weighted costs',[...document.querySelectorAll('.center-card:first-child .meeting-metrics b')].map(e=>e.firstChild.textContent).join('|')===[integer(stats.results),integer(metricDisplayData(stats,'leads').value),integer(metricDisplayData(stats,'booking').value),money(stats.cpr),money(metricDisplayData(stats,'cpl').value),money(metricDisplayData(stats,'cpb').value),percent(metricDisplayData(stats,'bookingRate').value)].join('|'));
  $('centerFilter').value='BDS';render();check('Empty Center Insights card keeps unknown values',[...document.querySelectorAll('#viewContent .center-card .meeting-metrics b')].every(e=>e.textContent===money(null)));
  navigate('meeting');
  meetingTab='bucket';$('centerFilter').value='BDS';render();check('Bucket survives unrelated analysis filters',$('viewContent').textContent.includes(initial.title));
  const wasLoaded=loaded;try{loaded=false;meetingTab='bucket';navigate('meeting');check('Saved bucket accessible without sheet connection',$('viewContent').textContent.includes(initial.title));}finally{loaded=wasLoaded;}
  reset();meetingTab='learning';render();const savedRows=rows;
  try{
    const first=selected[0];rows=[{...first,day:$('startFilter').value,ad:'pillar-a',pillar:'Pillar QA',message:'Message QA',spend:100000,results:20,leads:10,booking:5},{...first,day:$('startFilter').value,ad:'pillar-b',pillar:'Pillar QA',message:'Message QA',spend:200000,results:20,leads:10,booking:5},{...first,day:$('startFilter').value,ad:'peer',pillar:'Other',message:'Other',spend:600000,results:10,leads:3,booking:1}];render();
    const g=meetingLearningGroups('pillar').find(g=>g.name==='Pillar QA');check('Pillar ratios weighted and peer excludes all supporting ads',g.cpb===30000&&g.peerCost===600000&&g.adCount===2&&g.worth&&!g.early);
    rows=rows.map(r=>({...r,pillar:''}));render();check('Missing pillar is not guessed',meetingLearningGroups('pillar').length===0&&$('viewContent').textContent.includes('No mappings'));
  }finally{rows=savedRows;reset();meetingTab='briefing';navigate('overview');}
  return checks;
})()
