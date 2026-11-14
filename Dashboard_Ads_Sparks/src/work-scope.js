let workView='centers';
const MY_THIRD_ADSET='ALLS-ENG-JU_T_D_W_TA_3/11/26';
const isPreheat=r=>r.center==='C.IN'||/^C\.IN(?:_|$)/i.test(r.adset);
function ownedRow(r){
  if(r.account==='Third')return r.brand==='English'&&r.adset===MY_THIRD_ADSET;
  return isPreheat(r)||A.MINE.includes(r.center);
}
function workspaceMatches(r){
  return (scope==='ALL'||ownedRow(r))&&(workView==='all'||(workView==='preheat'?isPreheat(r):!isPreheat(r)));
}
function campaignMatches(r){return $('campaignFilter').value==='ALL'||r.campaign===$('campaignFilter').value;}
function objectiveMatches(r,objective=$('objectiveFilter').value){return objective==='ALL'||(objective==='WHATSAPP'?['Traffic','Leads'].includes(r.objective):r.objective===objective);}
function workScopeControl(){
  document.querySelectorAll('[data-work-view]').forEach(b=>{const active=b.dataset.workView===workView;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});
}
function setWorkView(next){
  workView=next;$('centerFilter').value='ALL';$('campaignFilter').value='ALL';$('roleFilter').value='ALL';$('searchFilter').value='';$('messageFilter').value='ALL';page=0;updateOptions();render();
}
