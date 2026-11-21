const checks=[];function check(name,ok){checks.push({name,ok:!!ok});if(!ok)throw Error(name);}
let uuidCount=0;
const propertyData=new Map();const props={getProperty:k=>propertyData.get(k)||null,setProperty(k,v){propertyData.set(k,v);return this},deleteProperty(k){propertyData.delete(k);return this},getProperties:()=>Object.fromEntries(propertyData)};const PropertiesService={getDocumentProperties:()=>props};
const Utilities={formatDate:(d,tz,fmt)=>fmt==='yyyy-MM-dd'?d.toISOString().slice(0,10):'2026-11-09 20:00:00',getUuid:()=> 'import-test-'+(++uuidCount),base64Encode:x=>String(x),computeDigest:(a,b)=>b,DigestAlgorithm:{SHA_256:'test'}};
const headers=live[0],p=prepare('SE Main',csv,'replace','2026-10-01','2026-11-08'),start=performance.now();
const plan=buildImportOutput(live,p,'now'),delta=importDelta(live,plan.all),beforeOther=live.slice(1).filter(r=>r[39]!=='SE Main');
check('CSV retains 9905 rows and exact 18-digit IDs',p.rows.length===9905&&p.rows[0]['Ad ID']===csv[1][csv[0].indexOf('Ad ID')]);
check('Delta produces same rows as complete replacement',JSON.stringify(delta.grid.slice(1).filter(r=>r[0]).map(r=>importSignature(r,headers)).sort())===JSON.stringify(plan.all.map(r=>importSignature(r,headers)).sort()));
check('Other sources preserved exactly',JSON.stringify(delta.grid.slice(1).filter(r=>r[0]&&r[39]!=='SE Main'))===JSON.stringify(beforeOther));
check('Main spend matches CSV',delta.grid.slice(1).filter(r=>r[39]==='SE Main').reduce((n,r)=>n+r[15],0)===1035041511);
const again=importDelta(delta.grid,buildImportOutput(delta.grid,p,'later').all);
check('Repeat import is a true no-op including blank rows',again.changes.length===0&&again.clear.length===0);
check('Replacement removes duplicate old identities',delta.grid.slice(1).filter(r=>r[39]==='SE Main').length===9905);
const tiny=plan.all.slice(0,3).map(r=>r.slice()),before=[headers,...tiny],changed=tiny.map(r=>r.slice());changed[1][15]+=1;
const single=importDelta(before,changed);check('One changed spend writes one row with no reordering',single.changes.length===1&&single.changes[0]===2&&single.fresh.length===0);
const newrow=tiny[0].slice();newrow[50]='123456789012345678';newrow[3]='9/11/26 - NEW';
const add=importDelta(before,[...tiny,newrow]);check('New ad appends with formulas required',add.fresh.length===1&&add.fresh[0]===before.length);
const legacy=before.map((r,i)=>i? r.map((v,j)=>j>=47?'':v):r);
const upgrade=importDelta(legacy,tiny);check('ID migration reuses original rows',upgrade.changes.length===3&&upgrade.fresh.length===0&&upgrade.clear.length===0);
const timing={planningMs:Math.round(performance.now()-start),fileRows:p.rows.length,existingRows:live.length-1,changedRows:delta.changes.length,clearedRows:delta.clear.length,newRows:delta.fresh.length,existingFormulaRewrites:0};
// MOCK_SHEETS
reset(live);const message=commit(p),main=sheets.get('Raw Data');
const doneId=sheets.get('Import Log').data[1][13],writesBeforeRetry=writes;
check('Every log carries a request ID and fingerprint',!!doneId&&sheets.get('Import Log').data[1][14]===p.fingerprint);
check('Retrying the same completed request cannot rewrite data',commit({...p,requestId:doneId})===message&&writes===writesBeforeRetry);
check('Completed request can be recovered independently of callback',getImportStatus(doneId).done===true);
locked=false;check('Another running process cannot turn this completed job into a failure',getImportStatus(doneId).done===true&&!getImportStatus(doneId).ready);
check('Other account SUCCESS never confirms a new blocked job',getImportStatus('new-secondary-request').state==='BUSY'&&!getImportStatus('new-secondary-request').done);locked=true;
const saved=readImportJob_(doneId);saveImportJob_({...saved,state:'RUNNING'});check('Lost final metadata recovers from exact log row',getImportStatus(doneId).done===true);
saveImportJob_({...saved,requestId:'different-request',state:'RUNNING'});check('Different request ID cannot reuse a SUCCESS row',getImportStatus('different-request').state==='UNCONFIRMED');
saveImportJob_({...saved,state:'RUNNING',fingerprint:'different-file'});check('Different file fingerprint cannot reuse a SUCCESS row',getImportStatus(doneId).state==='UNCONFIRMED');saveImportJob_(saved);
check('Status check does not write spreadsheet cells',writes===writesBeforeRetry);

check('Commit finishes and logs measured stage',message.startsWith('Berhasil')&&sheets.get('Import Log').data[1][7]==='SUCCESS'&&sheets.get('Import Log').data[1][12].startsWith('Completed'));
check('Passive journal backs up only affected rows',sheets.get([...sheets.keys()].find(n=>n.startsWith('Backup delta'))).data.length===delta.changes.length+delta.clear.length+1);
check('Commit does not write original metric formulas',formulaWrites===0);
check('Final native ID columns remain text',main.data.filter(r=>r[39]==='SE Main').every(r=>typeof r[50]==='string'));
check('Reconciled commit spend',main.data.filter(r=>r[39]==='SE Main').reduce((n,r)=>n+r[15],0)===1035041511);
reset(delta.grid);commit(p);check('Confirmed no-op creates no journal',sheets.size===4&&flushes===1);
reset([headers]);commit({...p,rows:p.rows.slice(0,2)});check('New rows get derived formulas',sheets.get('Raw Data').data[1][30]===shiftedFormula(FORMULAS[30],2)&&sheets.get('Raw Data').data[2][31]===shiftedFormula(FORMULAS[31],3));
reset(before);const rp={...p,rows:p.rows.slice(0,2)};failWrite=true;let failed='';try{commit(rp)}catch(e){failed=e.message;}
check('Caught write failure restores changed rows',failed.includes('dipulihkan')&&sheets.get('Import Log').data[1][7]==='FAILED — restored');
locked=false;let blocked=false;try{commit(p)}catch(e){blocked=e.message.includes('masih berjalan')}check('Parallel import is blocked',blocked);
locked=true;reset([headers]);Utilities.parseCsv=()=>csv.slice(0,3);
const previewReply=uploadCsv('SE Main','test csv','upsert','','','');
check('CSV preview carries distinct operation ID',!!previewReply.requestId&&!!previewReply.token);
locked=false;const busyReply=uploadCsv('SE Main','test csv','upsert','','',previewReply.token,previewReply.requestId);
check('Busy CSV submission returns a structured not-started response',busyReply.state==='BUSY'&&!busyReply.done&&busyReply.requestId===previewReply.requestId&&sheets.get('Import Log').data.length===1);
locked=true;const completedReply=uploadCsv('SE Main','test csv','upsert','','',previewReply.token,previewReply.requestId);
check('CSV completion retains the same operation ID',completedReply.done&&completedReply.requestId===previewReply.requestId&&getImportStatus(previewReply.requestId).done);
const cacheData=new Map(),CacheService={getUserCache:()=>({
 putAll:values=>Object.entries(values).forEach(([k,v])=>cacheData.set(k,v)),
 get:k=>cacheData.get(k),getAll:keys=>Object.fromEntries(keys.filter(k=>cacheData.has(k)).map(k=>[k,cacheData.get(k)]))
})};
const packed='gzip64:'+('x'.repeat(170000)),cacheId='meta-cache-test';
metaCsvCache_(cacheId,packed);check('Cached upload pieces reassemble exactly',metaCsvCache_(cacheId)===packed);
cacheData.delete('meta.csv.'+cacheId+'.1');
check('Evicted piece requests original upload before writing',uploadCachedMetaCsv('SE Main','upsert','','','preview-token',cacheId).needsFile===true);
return {checks,timing};
