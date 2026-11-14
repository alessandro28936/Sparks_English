/* Delta writer: preserve row positions and all formulas on existing rows. */
function importSignature(v,headers){return JSON.stringify(headers.map((h,j)=>j in FORMULAS||h==='Imported At'||h==='Import Note'?null:['Day','Reporting starts','Reporting ends'].includes(h)?dateKey(v[j]):v[j]??''));}
function importDelta(old,desired){
 const headers=old[0],key=v=>identity(Object.fromEntries(headers.map((h,j)=>[h,v[j]]))),name=v=>nameIdentity(Object.fromEntries(headers.map((h,j)=>[h,v[j]])));
 const exact=new Map(),legacy=new Map(),used=new Set(),pending=[],changes=[];const grid=old.map(r=>r.slice());
 function add(map,k,i){if(!map.has(k))map.set(k,[]);map.get(k).push(i);}
 for(let i=1;i<old.length;i++){if(!old[i][0])continue;add(exact,key(old[i]),i);if(!old[i][50])add(legacy,name(old[i]),i);}
 function take(list){while(list?.length){const i=list.shift();if(!used.has(i))return i;}return null;}
 for(const row of desired){let i=take(exact.get(key(row)));if(i===null&&row[50])i=take(legacy.get(name(row)));if(i===null){pending.push(row);continue;}used.add(i);
  if(importSignature(old[i],headers)!==importSignature(row,headers)){grid[i]=row;changes.push(i);}
 }
 const slots=[];for(let i=1;i<old.length;i++)if(!used.has(i))slots.push(i);
 const fresh=[];for(const row of pending){const i=slots.length?slots.shift():grid.length;grid[i]=row;changes.push(i);fresh.push(i);used.add(i);}
 const clear=[];for(const i of slots)if(old[i][0]){grid[i]=Array(headers.length).fill('');clear.push(i);}
 return {grid,changes:changes.sort((a,b)=>a-b),clear,fresh,count:desired.length};
}
function importRuns(indices){const out=[];for(const i of [...new Set(indices)].sort((a,b)=>a-b)){const last=out.at(-1);if(last&&i===last.end+1)last.end=i;else out.push({start:i,end:i});}return out;}
function columnName(index){let name='';for(let n=index+1;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;}
function commit(p){
 const started=Date.now(),lock=LockService.getDocumentLock();
 if(!lock.tryLock(1000)){const error=Error('Impor lain masih berjalan. Permintaan baru belum dimulai.');error.code='IMPORT_BUSY';throw error;}
 let job=null,phase='beforeWrite';
 try{
  const requestId=importJobId_(p.requestId||Utilities.getUuid()),prior=readImportJob_(requestId);
  if(prior){if(prior.fingerprint!==p.fingerprint||prior.source!==p.source)throw Error('Import ID digunakan untuk file berbeda. Preview ulang.');if(prior.state==='SUCCESS')return prior.message;throw Error('Import ID sudah diproses. Periksa status sebelum membuat Preview baru.');}
  job={requestId,fingerprint:p.fingerprint,source:p.source,start:p.start,end:p.end,state:'RUNNING',stage:'Preparing changes',updated:Date.now()};saveImportJob_(job);importProperties_().setProperty(IMPORT_ACTIVE,requestId);pruneImportJobs_();
  const stage=message=>{job.stage=message;saveImportJob_(job);};
  const ss=book(),raw=ss.getSheetByName('Raw Data'),old=raw.getDataRange().getValues(),now=Utilities.formatDate(new Date(),'Asia/Jakarta','yyyy-MM-dd HH:mm:ss');
  const plan=buildImportOutput(old,p,now),delta=importDelta(old,plan.all),affected=[...delta.changes,...delta.clear].sort((a,b)=>a-b);
  const mapping=ss.getSheetByName('Creative Mapping'),mapPlan=mappingRowsForImport(mapping.getDataRange().getValues(),p);
  const log=ss.getSheetByName('Import Log'),n=log.getLastRow()+1;ensureSize(log,n,15);
  job.logRow=n;saveImportJob_(job);
  log.getRange(1,14,1,2).setValues([['Import ID','File fingerprint']]);log.getRange(n,14,1,2).setValues([[job.requestId,job.fingerprint]]);
  log.getRange(1,10,1,4).setValues([['Backup / journal','Backup format','Duration (seconds)','Stage']]);
  const seconds=()=>Math.round((Date.now()-started)/1000);
  if(!affected.length){
   if(mapPlan.added.length){ensureSize(mapping,mapPlan.occupied+mapPlan.added.length,9);mapping.getRange(mapPlan.occupied+1,1,mapPlan.added.length,9).setValues(mapPlan.added);}
   log.getRange(n,1,1,13).setValues([[now,p.source,'Sparks Import',p.start,p.end,p.rows.length,0,'SUCCESS','No changes','','',seconds(),'Verified: data already identical']]);
   SpreadsheetApp.flush();job.state='SUCCESS';job.message='Selesai: data '+p.rows.length+' baris sudah identik. Tidak menulis ulang Raw Data. Durasi '+seconds()+' detik.';saveImportJob_(job);return job.message;
  }
  log.getRange(n,1,1,13).setValues([[now,p.source,'Sparks Import',p.start,p.end,p.rows.length,plan.removed,'RUNNING',p.mode,'','delta-v1',seconds(),'Backing up '+affected.length+' changed rows']]);
  stage('Backing up '+affected.length+' changed rows');
  const snapshots=new Map();
  for(const run of importRuns(affected.filter(i=>i<old.length))){const formulas=raw.getRange(run.start+1,1,run.end-run.start+1,plan.headers.length).getFormulas();for(let i=run.start;i<=run.end;i++)snapshots.set(i,restoreImportValues([old[i]],[formulas[i-run.start]])[0]);}
  for(const i of affected)if(!snapshots.has(i))snapshots.set(i,Array(plan.headers.length).fill(''));
  const stamp=Utilities.formatDate(new Date(),'Asia/Jakarta','yyyyMMdd HHmmss')+' '+Utilities.getUuid().slice(0,6),journal=ss.insertSheet('Backup delta '+stamp);
  const journalRows=[['Raw Data row','Prior cells JSON (dates tagged; formulas preserved)'],...affected.map(i=>[i+1,JSON.stringify(snapshots.get(i).map(v=>v instanceof Date?{date:v.toISOString()}:v))])];
  if(journalRows.some(r=>String(r[1]).length>49000))throw Error('Backup row terlalu panjang; impor dibatalkan sebelum Raw Data berubah.');
  ensureSize(journal,journalRows.length,2);journal.getRange(1,1,journalRows.length,2).setValues(journalRows);journal.hideSheet();log.getRange(n,10).setValue(journal.getName());
  let writing=false;
  try{
   if(mapPlan.added.length){ensureSize(mapping,mapPlan.occupied+mapPlan.added.length,9);mapping.getRange(mapPlan.occupied+1,1,mapPlan.added.length,9).setValues(mapPlan.added);}
   ensureSize(raw,delta.grid.length,plan.headers.length);
   log.getRange(n,13).setValue('Writing '+delta.changes.length+' rows; clearing '+delta.clear.length+' obsolete rows');
   writing=true;phase='writing';stage('Writing '+delta.changes.length+' rows');
   // Only input columns are written. Existing metric formulas stay in their original cells.
   for(const run of importRuns(delta.changes)){
    raw.getRange(run.start+1,48,run.end-run.start+1,4).setNumberFormat('@');
    for(const [col,width] of [[0,2],[3,1],[5,22],[39,3],[45,6]])raw.getRange(run.start+1,col+1,run.end-run.start+1,width).setValues(safeValues(delta.grid.slice(run.start,run.end+1).map(row=>row.slice(col,col+width))));
   }
   for(const run of importRuns(delta.clear))raw.getRange(run.start+1,1,run.end-run.start+1,plan.headers.length).clearContent();
   // Fill derived formulas only for new/reused rows, never all historical rows.
   for(const run of importRuns(delta.fresh))for(const [col,formula] of Object.entries(FORMULAS))raw.getRange(run.start+1,Number(col)+1,run.end-run.start+1,1).setFormulas(Array.from({length:run.end-run.start+1},(_,i)=>[shiftedFormula(formula,run.start+i+1)]));
   if(delta.changes.length)raw.getRangeList(importRuns(delta.changes).flatMap(r=>['F'+(r.start+1)+':F'+(r.end+1),'Z'+(r.start+1)+':AA'+(r.end+1)])).setNumberFormat('yyyy-mm-dd');
   stage('Applying changes');log.getRange(n,13).setValue('Waiting for Google Sheets to apply changes');SpreadsheetApp.flush();phase='committed';
  }catch(e){
   try{if(writing){for(const run of importRuns(affected))raw.getRange(run.start+1,1,run.end-run.start+1,plan.headers.length).setValues(Array.from({length:run.end-run.start+1},(_,j)=>snapshots.get(run.start+j)));SpreadsheetApp.flush();}phase='restored';log.getRange(n,8).setValue('FAILED — restored');log.getRange(n,13).setValue(String(e.message).slice(0,400));}
   catch(restoreError){throw Error('Pemulihan belum terkonfirmasi. Backup: '+journal.getName()+'. '+e.message+' / '+restoreError.message);}
   throw Error('Impor gagal; perubahan Raw Data dipulihkan. '+e.message);
  }
  const issues=ss.getSheetByName('Import Issues');if(p.duplicates.length){const first=issues.getLastRow()+1;ensureSize(issues,first+p.duplicates.length-1,5);issues.getRange(first,1,p.duplicates.length,5).setValues(safeValues(p.duplicates.map(([key,count])=>['DUPLICATE EXPORT IDENTITY',p.source,key,count,'Periksa export. Baris dipertahankan.'])));}
  log.getRange(n,8).setValue('SUCCESS');log.getRange(n,12,1,2).setValues([[seconds(),'Completed: '+delta.changes.length+' written, '+delta.clear.length+' cleared']]);
  SpreadsheetApp.flush();job.state='SUCCESS';job.message='Berhasil: '+p.rows.length+' baris diperiksa; '+delta.changes.length+' baris diperbarui dan '+delta.clear.length+' baris lama dikosongkan. Total '+delta.count+' baris. Durasi '+seconds()+' detik.';saveImportJob_(job);return job.message;
 }catch(error){
  if(job){job.state=['beforeWrite','restored'].includes(phase)?'FAILED':'UNCONFIRMED';job.message=String(error.message).slice(0,600);try{saveImportJob_(job);}catch(ignore){}}
  throw error;
 }finally{
  try{if(job&&importProperties_().getProperty(IMPORT_ACTIVE)===job.requestId)importProperties_().deleteProperty(IMPORT_ACTIVE);}finally{lock.releaseLock();}
 }
}
