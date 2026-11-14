const checks=[];function check(name,ok){checks.push({name,ok:!!ok});if(!ok)throw Error(name);}
const Utilities={formatDate:(d,tz,fmt)=>fmt==='yyyy-MM-dd'?d.toISOString().slice(0,10):'2026-11-09 16:00:00',getUuid:()=>String(Math.random()),base64Encode:x=>String(x),computeDigest:(a,b)=>b,DigestAlgorithm:{SHA_256:'test'}};
const headers=['Campaign name','Ad set name','Ad set trim','Ad name','Ad Trim','Day','Campaign delivery','Ad set delivery','Ad delivery','Delivery status','Delivery level','Campaign budget','Campaign budget type','Ad set budget','Ad set budget type','Amount spent (IDR)','Result type','Results','Cost per result','Frequency','3-second video plays','Impressions','Views','Video plays at 100%','Link clicks','Reporting starts','Reporting ends','Hook Rate','Views Rate','CTR','Leads','Booking','CPL','CPB','Results to Leads','Spend Share','Week Num','Key Message Content','Content Pillar','Import Source','Brand','Account Group','Entity Key','Report Key','Row Key','Import Note','Imported At','Account ID','Campaign ID','Ad Set ID','Ad ID'];
const started=performance.now(),p=prepare('SE Main',csv,'replace','2026-10-01','2026-11-08');
check('Full file parsed with 9905 rows',p.rows.length===9905);
check('CSV spend reconciles exactly',p.rows.reduce((n,r)=>n+r['Amount spent (IDR)'],0)===1035041511);
check('18-digit IDs retained exactly',p.rows.every((r,i)=>r['Ad ID']===csv[i+1][csv[0].indexOf('Ad ID')]&&r['Ad Set ID']===csv[i+1][csv[0].indexOf('Ad set ID')]));
check('Native ID identities unique',p.duplicates.length===0);
const initial=buildImportOutput([headers],p,'now');check('Initial plan retains full file',initial.all.length===9905&&!initial.unchanged);
const repeat=buildImportOutput([headers,...initial.all],p,'later');check('Identical full file skips Raw Data write',repeat.unchanged&&repeat.all.length===9905);
const migrated=initial.all.map(r=>{r=r.slice();for(let j=47;j<51;j++)r[j]='';return r;});
const upgrade=buildImportOutput([headers,...migrated],{...p,mode:'upsert'},'now');check('Legacy names migrate to IDs without duplicate spend',upgrade.all.length===9905&&upgrade.removed===9905&&!upgrade.unchanged);
const foreign=initial.all[0].slice();foreign[39]='SE Secondary';foreign[41]='Secondary';
const history=initial.all[0].slice();history[5]=serialDate('2026-09-30');history[25]=history[26]=history[5];
const scoped=buildImportOutput([headers,...initial.all,foreign,history],p,'later');check('Other source and outside-range history retained',scoped.all.length===9907&&scoped.all.includes(foreign)&&scoped.all.includes(history));
const partial={...p,rows:[p.rows[0]],mode:'upsert'};check('Upsert one ad/day preserves remaining rows',buildImportOutput([headers,...initial.all],partial,'later').all.length===9905);
const replaced=buildImportOutput([headers,...initial.all],{...partial,mode:'replace'},'later');check('Complete replacement removes absent source rows only',replaced.all.length===1);
const changed=initial.all.map(r=>r.slice());changed[0][15]+=1;check('Changed spend is not skipped',!buildImportOutput([headers,...changed],p,'later').unchanged);
for(const v of [120243827575280027,'1.2024382757528E+17']){let rejected=false;try{importId(v,'Ad ID',2)}catch(e){rejected=true}check('Unsafe ID rejected '+v,rejected);}
const maps=mappingRowsForImport([['Source','Campaign','Ad set','Ad','Date','Message','Pillar','Key','Note']],p);
check('Mapping formulas bundled with rows',maps.added.length>0&&maps.added.every(r=>r[7].startsWith('=IF(')));
check('Repeated creatives mapped only once',new Set(maps.added.map(r=>r.slice(0,4).join('|'))).size===maps.added.length);
check('Rollback preserves formulas and literal equals text',JSON.stringify(restoreImportValues([['=literal',5]],[['','=2+3']]))===JSON.stringify([["'=literal",'=2+3']]));
const timings={planningMs:Math.round(performance.now()-started),mappingRows:maps.added.length};
// Exercise the actual commit path against a recording spreadsheet double.
let writes=0,copyCalls=0,flushes=0,failWrite=false;
class Sheet{
 constructor(name,data){this.name=name;this.data=data.map(r=>r.slice());this.maxRows=Math.max(1000,data.length);this.maxCols=Math.max(26,data[0]?.length||0);this.hidden=false;}
 getName(){return this.name}getLastRow(){return this.data.length}getMaxRows(){return this.maxRows}getMaxColumns(){return this.maxCols}
 insertRowsAfter(n,extra){this.maxRows+=extra}insertColumnsAfter(n,extra){this.maxCols+=extra}hideSheet(){this.hidden=true}
 copyTo(){copyCalls++;throw Error('Live formula backup forbidden')}
 getDataRange(){return this.getRange(1,1,Math.max(1,this.data.length),this.maxCols)}
 getRangeList(){return {setNumberFormat(){}}}
 getRange(row,col,n=1,m=1){const self=this;return {
 getValues(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>self.data[row+i-1]?.[col+j-1]??''))},
 getFormulas(){return Array.from({length:n},()=>Array(m).fill(''))},getFormulasR1C1(){return Array.from({length:n},()=>Array(m).fill(''))},
 setNumberFormat(){return this},setValue(v){return this.setValues([[v]])},
 setValues(data){if(self.name==='Raw Data'&&failWrite){failWrite=false;throw Error('Simulated write failure')}writes++;for(let i=0;i<data.length;i++){self.data[row+i-1]||=[];for(let j=0;j<data[i].length;j++)self.data[row+i-1][col+j-1]=data[i][j];}return this},
 clearContent(){for(let i=0;i<n;i++)for(let j=0;j<m;j++)if(self.data[row+i-1])self.data[row+i-1][col+j-1]='';}
 };}
}
const sheets=new Map();function reset(old){sheets.clear();sheets.set('Raw Data',new Sheet('Raw Data',old));sheets.set('Creative Mapping',new Sheet('Creative Mapping',[['Source']]));sheets.set('Import Log',new Sheet('Import Log',[['Imported At']]));sheets.set('Import Issues',new Sheet('Import Issues',[['Issue']]));writes=copyCalls=flushes=0;}
const workbook={getId:()=>SPARKS_ID,getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet(n,[]);sheets.set(n,s);return s}};
let released=0,locked=true;const LockService={getDocumentLock:()=>({tryLock:()=>locked,releaseLock:()=>released++})};
const SpreadsheetApp={getActiveSpreadsheet:()=>workbook,flush:()=>flushes++};
reset([headers]);const result=commit(p);
check('Real commit writes full file once',sheets.get('Raw Data').data.length===9906&&result.startsWith('Berhasil'));
check('Formula backup never clones a live sheet',copyCalls===0&&[...sheets.keys()].some(n=>n.startsWith('Backup values')));
check('Mapping batch avoids per-row calls',writes<15);
check('ID text preserved in final output',sheets.get('Raw Data').data.slice(1).every(r=>typeof r[50]==='string'&&/^\d{18}$/.test(r[50])));
check('SUCCESS only after data flush',flushes===1&&sheets.get('Import Log').data[1][7]==='SUCCESS');
const writeCount=writes;
reset([headers,...initial.all]);commit(p);check('No-op skips backups and recalculation',sheets.size===4&&flushes===0&&sheets.get('Import Log').data[1][8]==='No changes');
reset([headers,foreign]);failWrite=true;let failure='';try{commit(p)}catch(e){failure=e.message}
check('Failed writes restore old Raw Data and never SUCCESS',failure.includes('dipulihkan')&&sheets.get('Import Log').data[1][7]==='FAILED — restored'&&sheets.get('Raw Data').data[1][39]==='SE Secondary');
locked=false;let rejected=false;try{commit(p)}catch(e){rejected=e.message.includes('masih berjalan')}check('Concurrent imports fail immediately',rejected);
return {checks,timings,spreadsheetWrites:writeCount};
