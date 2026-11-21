let workView='centers';
// Third-account North Jakarta ad sets use both JU and CL.JU prefixes.
// Match the center and stable ad-set prefix, not individual launch dates.
const isOwnedThirdNorthJakarta=r=>r.brand==='English'&&r.center==='CL.JU'&&/^ALLS-ENG-(?:JU|CL\.JU)_/i.test(r.adset);
const isPreheat=r=>r.center==='C.IN'||/^C\.IN(?:_|$)/i.test(r.adset);
const PIC_ASSIGNMENTS={
  MY:{label:'Ale',centers:A.MINE,canvas:['Traffic_WA_EXP_CBO_NEW','Traffic_WA_EXP_Hooks']},
  FARHAN:{label:'Farhan',centers:['KLM','KGD','BKP','SKL','CKR','PLM','STR','KMG','PPN','PLU','SMG','CL.JB'],
    canvas:['Sales_Website_EXP_Bookings','Lead_WA_EXP_Bookings','Traffic_WA_EXP_CBO_CANVAS']},
  FAHRI_BENTANG:{label:'Fahri + Bentang',centers:['BSD','TJD','BGR','DPK','PJT','SGB','YOG','BDG','BLI','CBR','DSW','MDN','TMI','CNR','CL.TGR'],
    canvas:['Traffic_WA_Diversified_Incubation','Traffic_WA_EXP_Preheat','Traffic_WA_Diversified_CANVAS']}
};
const centerOwners=new Map(),canvasOwners=new Map();
for(const [pic,assignment] of Object.entries(PIC_ASSIGNMENTS)){
  for(const center of assignment.centers)centerOwners.set(center,pic);
  for(const campaign of assignment.canvas)canvasOwners.set(campaign.toLowerCase(),pic);
}
function scopeLabel(){return PIC_ASSIGNMENTS[scope]?.label||'All Center';}
function assignedCenters(){return PIC_ASSIGNMENTS[scope]?.centers||Array.from(centerOwners.keys());}
function ownerForRow(r){
  if(isPreheat(r)){
    const campaign=String(r.campaign||'').trim().toLowerCase().replace(/[_ -]+\d{1,2}\/\d{1,2}\/\d{2,4}$/,'');
    return canvasOwners.get(campaign);
  }
  const pic=centerOwners.get(r.center);
  if(pic==='MY'&&r.account==='Third'&&!isOwnedThirdNorthJakarta(r))return;
  if(r.brand==='SLSA'&&pic!=='MY')return;
  return pic;
}
function ownedRow(r){return ownerForRow(r)==='MY';}
function workspaceMatches(r){
  const canvas=isPreheat(r);
  if((workView==='preheat'&&!canvas)||(workView==='centers'&&canvas))return false;
  if(canvas&&scope==='ALL')return true;
  const owner=ownerForRow(r);
  return scope==='ALL'?!!owner:owner===scope;
}
function selectPic(pic){
  if(!Object.hasOwn(PIC_ASSIGNMENTS,pic)&&pic!=='ALL')return;
  scope=pic;
  setWorkView(pic==='ALL'?'centers':workView);
}
function campaignMatches(r){return $('campaignFilter').value==='ALL'||r.campaign===$('campaignFilter').value;}
function objectiveMatches(r,objective=$('objectiveFilter').value){return objective==='ALL'||(objective==='WHATSAPP'?['Traffic','Leads'].includes(r.objective):r.objective===objective);}
function workScopeControl(){
  document.querySelectorAll('[data-pic]').forEach(button=>{
    const active=button.dataset.pic===scope;
    button.classList.toggle('selected',active);
    button.setAttribute('aria-pressed',String(active));
  });
  document.querySelectorAll('[data-work-view]').forEach(b=>{const active=b.dataset.workView===workView;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});
}
function setWorkView(next){
  if(next==='preheat'&&workView!=='preheat')$('objectiveFilter').value='ALL';
  workView=next;$('centerFilter').value='ALL';$('campaignFilter').value='ALL';$('roleFilter').value='ALL';$('searchFilter').value='';$('messageFilter').value='ALL';page=0;updateOptions();render();
}
