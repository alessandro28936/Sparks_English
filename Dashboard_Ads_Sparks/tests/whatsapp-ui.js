(() => {
 const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
 const sample=rows.find(r=>r.objective==='Traffic'&&r.resultType==='Messaging conversations started');
 const a={...sample,spend:100000,results:10,leads:8,booking:1},b={...a,objective:'Leads',spend:200000,results:20,leads:16,booking:2,ad:'LEADS_TEST'};
 const s=A.aggregate([a,b]);
 check('Traffic and Leads messaging are comparable',!s.mixed&&s.cpr===10000);
 check('WhatsApp costs are ratios of combined totals',s.cpl===12500&&s.cpb===100000);
 check('WhatsApp conversions combine matching counts',s.leadRate===80&&s.bookingRate===12.5);
 check('One result chart context for Traffic plus Leads',overviewGroups([a,b],'cpr').length===1);
 check('Context label uses WhatsApp',contextLabel(a).includes('WhatsApp')&&!contextLabel(a).includes('Traffic'));
 const zero={...a,results:0,leads:0,booking:0,spend:30000,resultType:'Tidak tercatat'};
 check('Zero-result WhatsApp spend is retained',overviewGroups([a,b,zero],'cpr').length===1&&A.aggregate([a,b,zero]).cpr===11000);
 check('Missing raw type is not rewritten',zero.resultType==='Tidak tercatat');
 check('Sales and Booking remain separate',overviewGroups([a,b,{...b,objective:'Sales',resultType:'Booking'}],'cpr').length===2&&A.aggregate([a,{...b,objective:'Sales',resultType:'Booking'}]).mixed);
 check('Clicks are not counted as WhatsApp conversations',overviewGroups([a,{...b,resultType:'Link clicks'}],'cpr').length===2);
 check('Other brands remain separate',overviewGroups([a,{...b,brand:'SLSA'}],'cpr').length===2);
 check('Raw Meta objective remains unchanged',a.objective==='Traffic'&&b.objective==='Leads');
 const idx=Rules.index([a,b]);check('Center benchmark combines WhatsApp objectives',[...idx.centers.values()].some(r=>r.length===2));
 check('Combined filter accepts both objectives',objectiveMatches(a,'WHATSAPP')&&objectiveMatches(b,'WHATSAPP')&&!objectiveMatches({...b,objective:'Sales'},'WHATSAPP'));
 check('Individual objective filtering is retained',objectiveMatches(a,'Traffic')&&!objectiveMatches(b,'Traffic'));
 const before=$('objectiveFilter').value;
 try{
  $('objectiveFilter').value='WHATSAPP';updateOptions();navigate('overview');
  check('Live combined view contains Traffic and Leads',selected.some(r=>r.objective==='Traffic')&&selected.some(r=>r.objective==='Leads'));
  check('Live messaging has only one result context',overviewGroups(selected,'cpr').filter(g=>A.outcomeType(g.items[0])==='Messaging conversations started').length===1);
  check('Scope description is removed',!$('workScopeHint')&&!document.body.textContent.includes('My centers · Third account:'));
  check('No marketing subtitle remains visible',$('pageSubtitle').hidden&&$('pageTitle').textContent==='Overview');
  check('Long table methodology is absent from Overview',!document.querySelector('.adset-method')&&!document.querySelector('#viewContent').textContent.includes('Cell colors describe selected-period metrics'));
  check('Essential outcome matching labels remain',!!document.querySelector('.report-audit')&&document.querySelector('#viewContent').textContent.includes('Matched data'));
  navigate('data');check('Table methodology remains accessible in Data & Methodology',document.querySelector('#viewContent').textContent.includes('Ad set comparisons'));
  for(const view of ['centers','messages','creatives','alerts','meeting']){navigate(view);check(view+' still renders',!!$('viewContent').textContent.trim());}
 }finally{$('objectiveFilter').value=before;updateOptions();navigate('overview');}
 return checks;
})()
