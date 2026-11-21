/* Import identity and status are independent of the HTML callback. No CSV data is stored here. */
const IMPORT_JOB_PREFIX='sparks.import.job.',IMPORT_ACTIVE='sparks.import.active';
function importJobId_(id){if(typeof id!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(id))throw Error('Import ID tidak valid. Preview ulang.');return id;}
function importProperties_(){return PropertiesService.getDocumentProperties();}
function readImportJob_(id){const value=importProperties_().getProperty(IMPORT_JOB_PREFIX+importJobId_(id));return value?JSON.parse(value):null;}
function saveImportJob_(job){job.updated=Date.now();importProperties_().setProperty(IMPORT_JOB_PREFIX+job.requestId,JSON.stringify(job));}
function pruneImportJobs_(){
 const props=importProperties_(),entries=Object.entries(props.getProperties()).filter(([key])=>key.startsWith(IMPORT_JOB_PREFIX)).map(([key,value])=>({key,job:JSON.parse(value)})).sort((a,b)=>b.job.updated-a.job.updated);
 for(const entry of entries.slice(50))if(entry.job.state!=='RUNNING')props.deleteProperty(entry.key);
}
function importBusy_(id){
 const activeId=importProperties_().getProperty(IMPORT_ACTIVE),active=activeId?readImportJob_(activeId):null;
 return {done:false,state:'BUSY',requestId:id||'',ready:false,activeSource:active?.source||'',message:'Importer sedang dipakai proses lain. Permintaan ini belum menulis data.'};
}
function importJobResult_(job,ready){return {done:job.state==='SUCCESS',state:job.state,requestId:job.requestId,source:job.source,start:job.start,end:job.end,stage:job.stage||'',message:job.message||'',ready,logRow:job.logRow||null};}
function getImportStatus(requestId){
 const id=importJobId_(requestId),lock=LockService.getDocumentLock(),ready=lock.tryLock(1);
 try{
 const job=readImportJob_(id);
 if(!job)return ready?{done:false,state:'NOT_STARTED',requestId:id,ready:true}:importBusy_(id);
 if(job.state==='SUCCESS'||job.state==='FAILED')return importJobResult_(job,ready);
 // Recovery is read-only. Never infer completion from another job's SUCCESS row.
 if(ready&&job.logRow){
  const log=book().getSheetByName('Import Log'),row=log.getRange(job.logRow,1,1,15).getValues()[0];
  if(row[13]===id&&row[14]===job.fingerprint&&row[1]===job.source){
   if(row[7]==='SUCCESS')return importJobResult_({...job,state:'SUCCESS',message:job.message||'Import completed. '+row[12]},ready);
   if(String(row[7]).startsWith('FAILED'))return importJobResult_({...job,state:'FAILED',message:String(row[12])},ready);
  }
 }
 if(ready&&job.state==='RUNNING')return importJobResult_({...job,state:'UNCONFIRMED',message:'Proses tidak lagi memegang kunci, tetapi belum ada konfirmasi selesai untuk Import ID ini. Periksa Import Log / Executions.'},ready);
 return importJobResult_(job,ready);
 }finally{if(ready)lock.releaseLock();}
}
function metaCsvCache_(id,packed){
 const cache=CacheService.getUserCache(),prefix='meta.csv.'+importJobId_(id)+'.';
 if(packed){
  const chunks={};let n=0;
  for(let i=0;i<packed.length;i+=80000)chunks[prefix+(n++)]=packed.slice(i,i+80000);
  cache.putAll({...chunks,[prefix+'size']:String(n)},600);return;
 }
 const n=Number(cache.get(prefix+'size'));
 if(!Number.isInteger(n)||n<1||n>125)return '';
 const keys=Array.from({length:n},(_,i)=>prefix+i),chunks=cache.getAll(keys);
 return keys.every(k=>typeof chunks[k]==='string')?keys.map(k=>chunks[k]).join(''):'';
}
function uploadCachedMetaCsv(source,mode,start,end,confirmed,requestId){
 if(!confirmed||!SOURCES[source])throw Error('Preview ulang.');
 let packed;try{packed=metaCsvCache_(requestId);}catch(ignore){}
 if(!packed)return {needsFile:true,requestId};
 return uploadCsv(source,packed,mode,start,end,confirmed,requestId);
}
function uploadCsv(source,text,mode,start,end,confirmed,requestId){
 const packed=typeof text==='string'&&text.startsWith('gzip64:')?text:null;
 if(packed){
  if(packed.length>10000000||!SOURCES[source])throw Error('File kompresi tidak valid.');
  const blob=Utilities.newBlob(Utilities.base64Decode(packed.slice(7)),'application/gzip','meta.csv.gz');
  text=Utilities.ungzip(blob).getDataAsString('UTF-8');
 }
 if(typeof text!=='string'||text.length>10000000)throw Error('File terlalu besar atau tidak valid; bagi menjadi rentang tanggal lebih pendek.');
 const data=Utilities.parseCsv(text.replace(/^\uFEFF/,'')),daily=source==='Daily Report',plan=daily?prepareDaily(data,mode,start,end):prepare(source,data,mode,start,end);
 if(!confirmed){
  const id=Utilities.getUuid();let cached=false;
  if(packed)try{metaCsvCache_(id,packed);cached=true;}catch(ignore){}
  return {summary:daily?dailyPreview(plan):summary(plan),token:plan.fingerprint,requestId:id,cached};
 }
 if(confirmed!==plan.fingerprint)throw Error('File/opsi berubah. Preview ulang.');
 plan.requestId=requestId?importJobId_(requestId):Utilities.getUuid();
 try{return {done:true,state:'SUCCESS',requestId:plan.requestId,message:daily?commitDaily(plan):commit(plan)};}
 catch(error){if(error.code==='IMPORT_BUSY')return importBusy_(plan.requestId);throw error;}
}
