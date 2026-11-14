/** Sparks import workflow. Bound script for the existing Centers spreadsheet. */
const SPARKS_ID = '1rLd4NuAz9S2HqqiMUWqHXZkinYmjazgsm_mj473BfGw';
const SOURCES = {'SE Main':'Import SE Main','SE Secondary':'Import SE Secondary','SE Third':'Import SE Third','SLSA':'Import SLSA'};
function onOpen(){SpreadsheetApp.getUi().createMenu('Sparks Import').addItem('Upload CSV','showImport').addItem('Upload Daily Report CSV','showDailyImport').addSeparator().addItem('Import SE Main tab','importMain').addItem('Import SE Secondary tab','importSecondary').addItem('Import SE Third tab','importThird').addItem('Import SLSA tab','importSlsa').addSeparator().addItem('Refresh derived metrics','refreshMetrics').addToUi();}
function setup(){const ss=book();ss.toast('Menu Sparks Import siap. Refresh spreadsheet jika menu belum terlihat.');onOpen();}
function book(){const s=SpreadsheetApp.getActiveSpreadsheet();if(!s||s.getId()!==SPARKS_ID)throw Error('Pasang script pada spreadsheet Centers yang benar.');return s;}
function showImport(){SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(UPLOAD_HTML).setWidth(580).setHeight(740),'Import Meta Ads');}
function showDailyImport(){SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(UPLOAD_HTML.replace('<option>Daily Report</option>','<option selected>Daily Report</option>')).setWidth(580).setHeight(740),'Import Daily Report');}
function importMain(){importTab('SE Main');}function importSecondary(){importTab('SE Secondary');}function importThird(){importTab('SE Third');}function importSlsa(){importTab('SLSA');}
function importTab(source){const ss=book(),tab=ss.getSheetByName(SOURCES[source]);const data=tab.getDataRange().getValues();const plan=prepare(source,data,'upsert','','');const ui=SpreadsheetApp.getUi();if(ui.alert('Import '+source,summary(plan)+'\nMode: update ad/tanggal yang ada di export. Baris lain dipertahankan.\nLanjutkan?',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;ss.toast(commit(plan));}
function dateKey(v){if(v instanceof Date&&!isNaN(v))return Utilities.formatDate(v,'Asia/Jakarta','yyyy-MM-dd');if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+v*86400000).toISOString().slice(0,10);const t=String(v||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(t))throw Error('Tanggal harus yyyy-mm-dd: '+t);const d=new Date(t+'T00:00:00Z');if(isNaN(d)||d.toISOString().slice(0,10)!==t)throw Error('Tanggal tidak valid: '+t);return t;}
function serialDate(v){return (Date.parse(dateKey(v)+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;}
function readNumber(v,header){
 if(v===''||v==null)return '';
 if(typeof v==='number'&&Number.isFinite(v))return v;
 let s=String(v).trim();
 // Frequency is a ratio: accept either decimal separator, never thousands grouping.
 if(header==='Frequency'&&/^-?\d+,\d+$/.test(s))s=s.replace(',','.');
 if(!/^-?\d+(\.\d+)?$/.test(s)||!Number.isFinite(Number(s)))throw Error('Format angka tidak jelas pada '+header+': '+String(v)+'. '+(header==='Frequency'?'Gunakan desimal koma atau titik tanpa pemisah ribuan.':'Gunakan export angka tanpa pemisah ribuan, desimal titik.'));
 return Number(s);
}
function nameIdentity(r){return [r['Import Source'],r['Campaign name'],r['Ad set name'],r['Ad name'],dateKey(r.Day)].join('|');}
function identity(r){return r['Ad ID']?[r['Import Source'],'id',String(r['Ad ID']),dateKey(r.Day)].join('|'):nameIdentity(r);}
function importId(v,header,row){
 if(v===''||v==null)return '';
 if(typeof v==='number'&&!Number.isSafeInteger(v))throw Error(header+' sudah kehilangan presisi pada baris '+row+'. Gunakan upload CSV asli, bukan angka ID yang sudah dibulatkan oleh spreadsheet.');
 const s=String(v).trim();if(!/^\d+$/.test(s))throw Error(header+' tidak valid pada baris '+row+'. ID harus digit lengkap sebagai teks, bukan notasi ilmiah.');return s;
}
function prepare(source,data,mode,start,end){
 if(!SOURCES[source])throw Error('Pilih sumber yang valid.');if(!['upsert','replace'].includes(mode))throw Error('Mode tidak valid.');
 const headers=(data[0]||[]).map(v=>String(v).trim()==='Ad set ID'?'Ad Set ID':String(v).trim());if(new Set(headers).size!==headers.length)throw Error('Ada header duplikat/kosong.');
 const required=['Campaign name','Ad set name','Ad name','Day','Amount spent (IDR)','Results','Reporting starts','Reporting ends'];for(const k of required)if(!headers.includes(k))throw Error('Kolom wajib tidak ada: '+k);
 const numeric=['Campaign budget','Ad set budget','Amount spent (IDR)','Results','Cost per result','Frequency','3-second video plays','Impressions','Views','Video plays at 100%','Link clicks'];
 const rows=[];for(let i=1;i<data.length;i++){
  const v=data[i];if(v.every(x=>x===''||x==null))continue;if(String(v[0]).trim()==='Campaign name')continue;
  const r=Object.fromEntries(headers.map((h,j)=>[h,v[j]??'']));for(const h of ['Campaign name','Ad set name','Ad name']){r[h]=String(r[h]).trim();if(!r[h])throw Error('Nama kosong / summary row pada baris '+(i+1));if(r[h].includes('|'))throw Error('Karakter | tidak didukung dalam nama: baris '+(i+1));}
  for(const h of ['Account ID','Campaign ID','Ad Set ID','Ad ID'])if(h in r)r[h]=importId(r[h],h,i+1);
  r.Day=dateKey(r.Day);if(dateKey(r['Reporting starts'])!==r.Day||dateKey(r['Reporting ends'])!==r.Day)throw Error('Export harus per ad per hari: baris '+(i+1));
  const isSlsa=/(?:^|[^A-Z0-9])SLSA(?:$|[^A-Z0-9])/i.test(r['Campaign name']+' '+r['Ad set name']);if((source==='SLSA')!==isSlsa)throw Error('Brand tidak cocok dengan sumber pada baris '+(i+1));
  for(const h of numeric)if(h in r && !(h.endsWith('budget')&&isNaN(Number(r[h]))))r[h]=readNumber(r[h],h);
  if(Number(r['Amount spent (IDR)'])<0)throw Error('Spend negatif pada baris '+(i+1));
  r['Import Source']=source;rows.push(r);
 }
 if(!rows.length)throw Error('Tidak ada data iklan.');
 const dates=rows.map(r=>r.Day).sort(),first=dates[0],last=dates[dates.length-1];
 if(mode==='replace'){start=dateKey(start);end=dateKey(end);if(start>end||first<start||last>end)throw Error('Tanggal file di luar rentang penggantian.');}else{start=first;end=last;}
 const counts={};rows.forEach(r=>counts[identity(r)]=(counts[identity(r)]||0)+1);
 const duplicates=Object.entries(counts).filter(([k,n])=>n>1);
 const fingerprint=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify({source,rows,mode,start,end})));
 return {source,rows,mode,start,end,duplicates,fingerprint};
}
function summary(p){return p.rows.length+' baris | '+p.source+' | '+p.start+' s.d. '+p.end+'\nSpend: Rp'+p.rows.reduce((s,r)=>s+Number(r['Amount spent (IDR)']||0),0).toLocaleString('id-ID')+'\n'+p.duplicates.length+' identitas ad/tanggal berulang. Baris dipertahankan; Leads/Booking ambigu dikosongkan.\n'+(p.mode==='replace'?'Mengganti SEMUA data sumber tersebut dalam rentang ini. Pastikan export lengkap.':'Memperbarui ad/tanggal yang terdapat di file; tidak menghapus ad lain.');}
function shiftedFormula(f,row){return f.replace(/(\$?[A-Z]{1,3})(\$?)(\d+)/g,(m,col,abs,n)=>col+abs+(abs?n:Number(n)+row-2));}
function populateFormulas(values){for(let i=1;i<values.length;i++)for(const [col,f] of Object.entries(FORMULAS))values[i][Number(col)]=shiftedFormula(f,i+1);return values;}
function ensureSize(sheet,rows,cols){if(sheet.getMaxRows()<rows)sheet.insertRowsAfter(sheet.getMaxRows(),rows-sheet.getMaxRows());if(sheet.getMaxColumns()<cols)sheet.insertColumnsAfter(sheet.getMaxColumns(),cols-sheet.getMaxColumns());}
function safeValues(a){return a.map(row=>row.map(v=>typeof v==='string'&&v.startsWith('=')?"'"+v:v));}
/* Bundled into SparksImport.gs by build_import_ui.py. */
function buildImportOutput(old,p,now){
 const headers=old[0],sourceCol=headers.indexOf('Import Source'),dayCol=headers.indexOf('Day');
 for(const h of ['Day','Import Source','Brand','Account Group','Entity Key','Report Key','Row Key','Ad ID'])if(headers.indexOf(h)<0)throw Error('Schema Raw Data belum siap: '+h);
 // Formula locations are fixed by the existing workbook schema. Stop before writing if columns moved.
 for(const [col,name] of [[2,'Ad set trim'],[4,'Ad Trim'],[5,'Day'],[30,'Leads'],[31,'Booking'],[39,'Import Source'],[47,'Account ID'],[50,'Ad ID']])if(headers[col]!==name)throw Error('Kolom Raw Data berubah: '+name+'. Batalkan impor dan periksa schema.');
 const newKeys=new Set(p.rows.map(identity)),newNames=new Set(p.rows.map(nameIdentity)),keep=[],removed=[];
 for(let i=1;i<old.length;i++){
  const v=old[i];if(!v[0])continue;
  if(v[sourceCol]!==p.source){keep.push(v);continue;}
  const r=Object.fromEntries(headers.map((h,j)=>[h,v[j]]));
  let replace;
  try{replace=p.mode==='replace'?dateKey(r.Day)>=p.start&&dateKey(r.Day)<=p.end:newKeys.has(identity(r))||(!r['Ad ID']&&newNames.has(nameIdentity(r)));}
  catch(e){throw Error('Raw Data baris '+(i+1)+': '+e.message);}
  (replace?removed:keep).push(v);
 }
 const added=p.rows.map(r=>headers.map(h=>{
  if(['Day','Reporting starts','Reporting ends'].includes(h))return serialDate(r.Day);
  if(h==='Brand')return p.source==='SLSA'?'SLSA':'English';
  if(h==='Account Group')return p.source==='SE Main'?'Main':p.source==='SE Third'?'Third':'Secondary';
  if(h==='Imported At')return now;if(h==='Import Note')return 'Imported via Sparks Import';return r[h]??'';
 }));
 // Compare export fields only: derived outcomes/labels may change independently of the Meta export.
 const excluded=new Set([...Object.keys(FORMULAS).map(Number),headers.indexOf('Imported At'),headers.indexOf('Import Note')]);
 const signature=v=>JSON.stringify(headers.map((h,j)=>excluded.has(j)?null:['Day','Reporting starts','Reporting ends'].includes(h)?dateKey(v[j]):v[j]??''));
 const counts=new Map();removed.forEach(v=>{const k=signature(v);counts.set(k,(counts.get(k)||0)+1);});
 let unchanged=removed.length===added.length;
 for(const v of added){const k=signature(v),n=counts.get(k)||0;if(!n)unchanged=false;else counts.set(k,n-1);}
 // Sort once using cached day values; avoid repeated date formatting during comparisons.
 const all=[...keep,...added].map(v=>({v,day:serialDate(v[dayCol])})).sort((a,b)=>a.day-b.day||String(a.v[sourceCol]).localeCompare(String(b.v[sourceCol]))).map(x=>x.v);
 return {headers,all,removed:removed.length,unchanged};
}
function mappingRowsForImport(mappingValues,p){
 const seen=new Set(mappingValues.slice(1).map(r=>[r[0],r[1],r[2],r[3]].join('|'))),added=[];
 const occupied=mappingValues.reduce((last,r,i)=>r[0]?i+1:last,1);
 for(const r of p.rows){const key=[p.source,r['Campaign name'],r['Ad set name'],r['Ad name']].join('|');if(seen.has(key))continue;seen.add(key);const n=occupied+added.length+1;
  const row=safeValues([[p.source,r['Campaign name'],r['Ad set name'],r['Ad name'],'','','','','Isi key message dan pillar']])[0];
  row[7]='=IF(A'+n+'="","",A'+n+'&"|"&B'+n+'&"|"&C'+n+'&"|"&D'+n+'&IF(E'+n+'="","","|"&IF(ISNUMBER(E'+n+'),TEXT(E'+n+',"yyyy-mm-dd"),E'+n+')))';added.push(row);
 }
 return {occupied,added};
}
function restoreImportValues(values,formulas){
 const output=safeValues(values);for(let i=0;i<output.length;i++)for(let j=0;j<output[i].length;j++)if(formulas[i]?.[j])output[i][j]=formulas[i][j];return output;
}
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
function uploadCsv(source,text,mode,start,end,confirmed,requestId){
 if(typeof text!=='string'||text.length>10000000)throw Error('File terlalu besar atau tidak valid; bagi menjadi rentang tanggal lebih pendek.');
 const data=Utilities.parseCsv(text.replace(/^\uFEFF/,'')),daily=source==='Daily Report',plan=daily?prepareDaily(data,mode,start,end):prepare(source,data,mode,start,end);
 if(!confirmed)return {summary:daily?dailyPreview(plan):summary(plan),token:plan.fingerprint,requestId:Utilities.getUuid()};
 if(confirmed!==plan.fingerprint)throw Error('File/opsi berubah. Preview ulang.');
 plan.requestId=requestId?importJobId_(requestId):Utilities.getUuid();
 try{return {done:true,state:'SUCCESS',requestId:plan.requestId,message:daily?commitDaily(plan):commit(plan)};}
 catch(error){if(error.code==='IMPORT_BUSY')return importBusy_(plan.requestId);throw error;}
}

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

/* Daily Report exports are outcomes, not Meta exports. Repeated rows are additive. */
const DAILY_TAB='Copy of Daily Report';
const DAILY_HEADERS=['calendar_date','Ads Center','Adset Name','ad_name','CPB by Chat Date','CPB by Booking Date','CPL','CPR','Spend','Bookings by Chat Date','CVR by Chat Date','Bookings by Booking Date','CVR by Booking Date','Results to Leads','Leads','Results','NS'];
const DAILY_IDS=['Account Group','Account ID','Campaign ID','Ad Set ID','Ad ID'];
// User confirmed 2026-11-12: the latest CSV replaces prior outcomes within the selected import scope,
// including earlier additional-result rows. Never deduplicate repeated rows inside the new CSV.
function dailyNumber(v,h,row,required){
 let s=String(v??'').trim().replace(/^'/,'');
 if(['','-','—','null','N/A'].includes(s)){if(required)throw Error(h+' kosong pada baris '+row+'. Isi 0 hanya jika benar-benar nol.');return '';}
 const percent=s.endsWith('%');if(percent)s=s.slice(0,-1);
 if(!/^\d+(\.\d+)?$/.test(s)||!Number.isFinite(Number(s)))throw Error('Angka tidak valid pada '+h+', baris '+row+': '+v);
 const n=Number(s)/(percent?100:1);
 if(percent&&!['CVR by Chat Date','CVR by Booking Date','Results to Leads'].includes(h))throw Error('Persentase tidak valid pada '+h+', baris '+row);
 if(['Bookings by Chat Date','Bookings by Booking Date','Leads','Results','NS'].includes(h)&&!Number.isSafeInteger(n))throw Error(h+' harus bilangan bulat: baris '+row);
 return n;
}
function dailyAccount(r){return String(r[26]||(/(?:^|_)TA(?:_|$)/i.test(r[2])?'Third':'')).trim();}
function dailyBase(r){return JSON.stringify([dateKey(r[0]),...r.slice(1,4).map(v=>String(v).trim())]);}
function dailyContext(r){return JSON.stringify([dailyAccount(r),...r.slice(27,31).map(v=>String(v??'').trim())]);}
function dailyKey(r){return dailyBase(r)+'|'+dailyContext(r);}
function dailyLabel(value){const s=String(value??'').trim();return !s||/^(?:'?[-–—]|n\/a|null|none)$/i.test(s)||/^#(?:REF!|N\/A|VALUE!|DIV\/0!|ERROR!|NAME\?|NUM!|SPILL!)/i.test(s)?'':s;}
function prepareDaily(data,mode,start,end){
 if(!['upsert','replace'].includes(mode))throw Error('Mode tidak valid.');
 const names=[...DAILY_HEADERS,...DAILY_IDS],headers=(data[0]||[]).map(h=>{h=String(h).trim();return /^date$/i.test(h)?'calendar_date':names.find(n=>n.toLowerCase()===h.toLowerCase())||h;});
 if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw Error('Header kosong atau duplikat.');
 if(!headers.includes('calendar_date'))throw Error('Daily Report memerlukan calendar_date (yyyy-mm-dd). Export Week saja tidak bisa diimpor; gunakan breakdown harian.');
 for(const h of DAILY_HEADERS)if(!headers.includes(h))throw Error('Kolom Daily Report wajib tidak ada: '+h);
 const rows=[],provided=DAILY_IDS.map(h=>headers.includes(h));
 for(let i=1;i<data.length;i++){
  const v=data[i];if(v.every(x=>x===''||x==null))continue;
  if(v.length!==headers.length)throw Error('Jumlah kolom tidak sesuai pada baris '+(i+1));
  const obj=Object.fromEntries(headers.map((h,j)=>[h,v[j]])),r=Array(31).fill('');
  const day=dateKey(obj.calendar_date);if(day<'2026-07-01')throw Error('Baris '+(i+1)+' sebelum 1 Juli 2026. Export hanya Juli dan seterusnya.');r[0]=serialDate(day);
  for(let j=1;j<4;j++){r[j]=String(obj[DAILY_HEADERS[j]]||'').trim();if(!r[j])throw Error(DAILY_HEADERS[j]+' kosong pada baris '+(i+1));}
  if(/(?:^|[^A-Z0-9])SLSA(?:$|[^A-Z0-9])/i.test(r[2]))throw Error('Daily Report ini untuk Sparks English. Data SLSA memakai sheet Daily Report SLSA.');
  // Previously confirmed typo: preserve its correction on re-import, scoped to this report identity.
  if(day==='2026-11-09'&&/^(?:CL\.)?JU_T_D_W_TA$/i.test(r[2])&&r[3]==='VEXTR_30/')r[3]='VEXTR_30';
  for(let j=4;j<17;j++)r[j]=dailyNumber(obj[DAILY_HEADERS[j]],DAILY_HEADERS[j],i+1,[8,11,14,15].includes(j));
  DAILY_IDS.forEach((h,j)=>{if(!provided[j])return;const s=String(obj[h]||'').trim();r[26+j]=j?importId(s,h,i+1):s;if(!j&&s&&!['Main','Secondary','Third'].includes(s))throw Error('Account Group harus Main, Secondary atau Third: baris '+(i+1));});
  if(/(?:^|_)TA(?:_|$)/i.test(r[2])&&r[26]&&r[26]!=='Third')throw Error('_TA adalah Third account: baris '+(i+1));
  if(r[30]&&!r[27])throw Error('Ad ID memerlukan Account ID: baris '+(i+1));
  rows.push(r);
 }
 if(!rows.length)throw Error('Tidak ada baris Daily Report.');
 const dates=rows.map(r=>dateKey(r[0])).sort();
 if(mode==='replace'){start=dateKey(start);end=dateKey(end);if(start<'2026-07-01'||start>end||dates[0]<start||dates.at(-1)>end)throw Error('Tanggal file di luar rentang penggantian.');}
 else{start=dates[0];end=dates.at(-1);}
 const counts=new Map();rows.forEach(r=>counts.set(dailyKey(r),(counts.get(dailyKey(r))||0)+1));
 const fingerprint=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify({source:'Daily Report',rows,provided,mode,start,end})));
 return {source:'Daily Report',rows,provided,mode,start,end,fileStart:dates[0],fileEnd:dates.at(-1),fingerprint,duplicates:[...counts.values()].reduce((s,n)=>s+Math.max(0,n-1),0)};
}
function dailySummary(p){
 const sum=j=>p.rows.reduce((s,r)=>s+Number(r[j]||0),0).toLocaleString('id-ID');
 const rangeWarning=p.mode==='replace'&&(p.start!==p.fileStart||p.end!==p.fileEnd)?'\nPERHATIAN: CSV hanya mencakup '+p.fileStart+' s.d. '+p.fileEnd+'. Data lama di luar tanggal file tetapi di dalam rentang penggantian juga akan dihapus. Sesuaikan Start/End date jika tidak dimaksudkan.':'';
 return p.rows.length+' baris | '+DAILY_TAB+' | '+p.start+' s.d. '+p.end+'\nLeads: '+sum(14)+' | Booking (Booking Date): '+sum(11)+' | Results: '+sum(15)+'\nSpend: Rp'+sum(8)+'\n'+p.duplicates+' baris dengan identitas berulang tetap dihitung sebagai hasil tambahan.\n'+(p.mode==='replace'?'PERHATIAN: mengganti SEMUA center/account dalam rentang ini di Copy of Daily Report. Gunakan hanya export lengkap semua center.':'Memperbarui kelompok tanggal + center + ad set + ad dalam file. Baris lain tetap. Upload ulang tidak menambah salinan.')+rangeWarning;
}
function dailyPreview(p){
 const lock=LockService.getDocumentLock();if(!lock.tryLock(1))throw Error('Importer sedang digunakan. Tunggu proses tersebut selesai, lalu Preview lagi.');
 try{const sheet=book().getSheetByName(DAILY_TAB);if(!sheet)throw Error(DAILY_TAB+' tidak ditemukan.');const window=dailyReadWindow(sheet,p),delta=dailyDelta(window.old,p);return dailySummary(p)+'\nPerubahan: '+delta.changes.length+' baris diperbarui, '+delta.clear.length+' baris lama diganti. Total sesudah import: '+(window.prefixCount+delta.count)+' baris.\n'+delta.labels.length+' Key Messages dari baris yang diganti akan disimpan di Daily Report Labels.';}
 finally{lock.releaseLock();}
}
function dailyReadWindow(sheet,p){
 const last=sheet.getLastRow(),header=sheet.getRange(1,1,1,31).getValues()[0];
 if(last<2)return {old:[header],offset:0,prefixCount:0};
 // Scan only one date column across history. Read all 31 columns only from the first affected day onward.
 // Include later dates in the tail so backfills can be sorted without moving any historical prefix.
 const dates=sheet.getRange(2,1,last-1,1).getValues(),cache=new Map(),start=serialDate(p.start);
 let first=last+1,prefixCount=0;
 for(let i=0;i<dates.length;i++){
  const value=dates[i][0];if(value===''||value==null)continue;
  const key=value instanceof Date?value.getTime():String(value);
  let day=cache.get(key);if(day===undefined){try{day=serialDate(value);}catch(e){throw Error('Tanggal Daily Report tidak valid pada baris '+(i+2)+'. '+e.message);}cache.set(key,day);}
  if(day>=start){first=i+2;break;}prefixCount++;
 }
 return {old:[header,...(first<=last?sheet.getRange(first,1,last-first+1,31).getValues():[])],offset:first-2,prefixCount};
}
function dailyDelta(old,p){
 for(let j=0;j<17;j++)if(old[0]?.[j]!==DAILY_HEADERS[j])throw Error('Kolom Daily Report berubah: '+DAILY_HEADERS[j]);
 for(let j=0;j<5;j++)if(old[0]?.[26+j]!==DAILY_IDS[j])throw Error('Kolom Daily Report berubah: '+DAILY_IDS[j]);
 // Apps Script returns Date objects. Format each distinct date once, not on every identity comparison.
 const dates=new Map(),grid=old.map((r,i)=>{const out=Array.from({length:31},(_,j)=>r[j]??'');if(i&&out[0] instanceof Date){const key=out[0].getTime();if(!dates.has(key))dates.set(key,serialDate(out[0]));out[0]=dates.get(key);}return out;}),groups=new Map(),incoming=new Map();
 for(let i=1;i<grid.length;i++){
  const r=grid[i];if(!r[0])continue;
  let key;try{key=dailyBase(r);}catch(e){throw Error('Tanggal Daily Report tidak valid pada baris '+(i+1)+'. Rapikan sebelum import.');}
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
 }
 // Missing IDs may inherit a single unambiguous context, never another account's outcomes.
 for(const original of p.rows){
  const r=original.slice(),base=dailyBase(r),matches=(groups.get(base)||[]).filter(i=>{
   const oldRow=grid[i];return DAILY_IDS.every((h,j)=>!r[26+j]||!oldRow[26+j]||r[26+j]===String(oldRow[26+j]));
  });
  const contexts=new Map(matches.map(i=>[dailyContext(grid[i]),grid[i]]));
  if(contexts.size>1)throw Error('Account/ID ambigu untuk '+r[2]+' / '+r[3]+' / '+dateKey(r[0])+'. Sertakan Account Group dan ID yang sesuai.');
  if(contexts.size===1){const prior=[...contexts.values()][0];for(let j=26;j<31;j++)if(!r[j])r[j]=prior[j];if(dailyContext(r)!==dailyContext(prior))throw Error('Ada laporan lama tanpa Account/ID untuk '+r[2]+' / '+r[3]+'. Lengkapi atribusi baris lama dahulu agar tidak menggandakan hasil.');}
  const key=dailyKey(r);if(!incoming.has(key))incoming.set(key,[]);incoming.get(key).push(r);
 }
 const exact=new Map();for(const indices of groups.values())for(const i of indices){const key=dailyKey(grid[i]);if(!exact.has(key))exact.set(key,[]);exact.get(key).push(i);}
 const changes=[],fresh=[],clear=[],used=new Set();let removed=0;
 const signature=r=>JSON.stringify([dateKey(r[0]),...r.slice(1,17),...r.slice(26,31)]);
 for(const [key,rows] of incoming){
  const indices=[...(exact.get(key)||[])];
  // Assign matching rows first: extra outcomes and manually entered labels keep their own rows.
  const pending=[];for(const r of rows){const at=indices.findIndex(i=>signature(grid[i])===signature(r));if(at>=0)used.add(indices.splice(at,1)[0]);else pending.push(r);}
  for(const r of pending){
   const i=indices.length?indices.shift():grid.length;used.add(i);
   if(i===grid.length){grid.push(r.slice());fresh.push(i);}else{grid[i]=[...r.slice(0,17),...grid[i].slice(17,26),...r.slice(26,31)];}
   changes.push(i);
  }
 }
 const retainedLabels=new Map();for(const i of used){const label=dailyLabel(grid[i][21]);if(!label)continue;const key=dailyKey(grid[i]);if(!retainedLabels.has(key))retainedLabels.set(key,new Set());retainedLabels.get(key).add(label);}
 const labels=[];
 for(let i=1;i<old.length;i++){
  if(!grid[i][0]||used.has(i))continue;
  const replace=p.mode==='replace'?dateKey(grid[i][0])>=p.start&&dateKey(grid[i][0])<=p.end:incoming.has(dailyKey(grid[i]));
  if(!replace)continue;
  // Archive genuine labels that no replacement row retains. Placeholder '-' is not a message.
  const label=dailyLabel(grid[i][21]);
  if(label&&!retainedLabels.get(dailyKey(grid[i]))?.has(label))labels.push({row:i+1,cells:[dateKey(grid[i][0]),...grid[i].slice(1,4),dailyAccount(grid[i]),...grid[i].slice(27,31),label]});
  grid[i]=Array(31).fill('');clear.push(i);removed++;
 }
 return {grid,changes,fresh,clear,removed,labels,count:grid.slice(1).filter(r=>r[0]).length};
}
function dailyWriteBlocks(sheet,first,values,col){if(!values.length)return;const size=Math.min(12000,Math.max(1,Math.floor(150000/values[0].length)));for(let offset=0;offset<values.length;offset+=size)sheet.getRange(first+offset,col,Math.min(size,values.length-offset),values[0].length).setValues(values.slice(offset,offset+size));}
function archiveDailyLabels(ss,labels,job,now,journal){
 if(!labels.length)return;
 const headers=['Day','Ads Center','Adset Name','ad_name',...DAILY_IDS,'Key Messages','Archived At','Import ID','Source row before sort','Backup'];
 let sheet=ss.getSheetByName('Daily Report Labels');
 if(!sheet){sheet=ss.insertSheet('Daily Report Labels');if(sheet.getMaxColumns()>headers.length)sheet.deleteColumns(headers.length+1,sheet.getMaxColumns()-headers.length);ensureSize(sheet,1,headers.length);sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);}
 const existing=sheet.getDataRange().getValues();for(let j=0;j<headers.length;j++)if(existing[0]?.[j]!==headers[j])throw Error('Schema Daily Report Labels berubah. Daily Report belum ditulis.');
 const key=r=>JSON.stringify([dateKey(r[0]),...r.slice(1,10).map(v=>String(v??''))]),seen=new Set(existing.slice(1).filter(r=>r[0]).map(key)),added=[];
 for(const item of labels){const k=key(item.cells);if(seen.has(k))continue;seen.add(k);added.push([...item.cells,now,job.requestId,item.row,journal]);}
 if(added.length){const first=sheet.getLastRow()+1;ensureSize(sheet,first+added.length-1,headers.length);sheet.getRange(first,1,added.length,10).setNumberFormat('@');dailyWriteBlocks(sheet,first,safeValues(added),1);}
}
function commitDaily(p){
 const started=Date.now(),lock=LockService.getDocumentLock();
 if(!lock.tryLock(1000)){const error=Error('Importer sedang dipakai proses lain.');error.code='IMPORT_BUSY';throw error;}
 let job=null,phase='beforeWrite';
 try{
  const id=importJobId_(p.requestId),prior=readImportJob_(id);
  if(prior){if(prior.fingerprint!==p.fingerprint||prior.source!==p.source)throw Error('Import ID tidak cocok. Preview ulang.');if(prior.state==='SUCCESS')return prior.message;throw Error('Import ID sudah diproses. Periksa status.');}
  job={requestId:id,fingerprint:p.fingerprint,source:p.source,start:p.start,end:p.end,state:'RUNNING',stage:'Reading affected Daily Report dates',started,targetSeconds:120};saveImportJob_(job);importProperties_().setProperty(IMPORT_ACTIVE,id);pruneImportJobs_();
  let stageStarted=started;const timings=[];
  const stage=s=>{const at=Date.now();timings.push(job.stage+': '+Math.round((at-stageStarted)/1000)+'s');stageStarted=at;job.stage=s;job.elapsedSeconds=Math.round((at-started)/1000);saveImportJob_(job);},ss=book(),sheet=ss.getSheetByName(DAILY_TAB);
  if(!sheet)throw Error(DAILY_TAB+' tidak ditemukan.');
  const window=dailyReadWindow(sheet,p),old=window.old,offset=window.offset,delta=dailyDelta(old,p),affected=[...delta.changes,...delta.clear],log=ss.getSheetByName('Import Log'),n=log.getLastRow()+1;
  delta.labels.forEach(label=>label.row+=offset);
  ensureSize(log,n,15);job.logRow=n;saveImportJob_(job);
  const now=Utilities.formatDate(new Date(),'Asia/Jakarta','yyyy-MM-dd HH:mm:ss'),seconds=()=>Math.round((Date.now()-started)/1000);
  log.getRange(n,1,1,15).setValues([[now,p.source,'CSV',p.start,p.end,p.rows.length,delta.removed,'RUNNING',p.mode,'','daily-tail-v2',seconds(),'Validating changes; historical prefix left unchanged',id,p.fingerprint]]);
  let journalName='';
  if(affected.length){
   const first=affected.reduce((a,b)=>Math.min(a,b)),last=affected.reduce((a,b)=>Math.max(a,b)),count=last-first+1,existing=Math.max(0,Math.min(last+1,old.length)-first);
   stage('Backing up affected Daily Report rows');
   const forms=existing?sheet.getRange(offset+first+1,1,existing,31).getFormulas():[];
   const before=Array.from({length:count},(_,j)=>old[first+j]||Array(31).fill('')),snapshot=restoreImportValues(before,forms);
   const stamp=Utilities.formatDate(new Date(),'Asia/Jakarta','yyyyMMdd HHmmss')+' '+Utilities.getUuid().slice(0,6),journal=ss.insertSheet('Backup Daily '+stamp);journalName=journal.getName();
   const backup=[['Row before sort','Prior cells JSON (dates tagged; formulas preserved)'],...snapshot.map((r,i)=>[offset+first+i+1,JSON.stringify(r.map(v=>v instanceof Date?{date:v.toISOString()}:v))])];
   if(backup.some(r=>String(r[1]).length>49000))throw Error('Backup row terlalu panjang; belum ada perubahan Daily Report.');
   // Keep the backup narrow; expanding a default 26-column sheet wastes workbook capacity.
   if(journal.getMaxColumns()>2)journal.deleteColumns(3,journal.getMaxColumns()-2);
   ensureSize(journal,backup.length,2);dailyWriteBlocks(journal,1,backup,1);journal.hideSheet();log.getRange(n,10).setValue(journalName);
   if(delta.labels.length){stage('Preserving Key Messages in Daily Report Labels');archiveDailyLabels(ss,delta.labels,job,now,journalName);}
   ensureSize(sheet,offset+delta.grid.length,31);
   const next=delta.grid.slice(first,last+1),write=restoreImportValues(next,forms);
   // Combine input, IDs and helpers in the same batch. Retain every untouched formula and manual label.
   for(const i of delta.changes){const input=safeValues([delta.grid[i]])[0];write[i-first].splice(0,17,...input.slice(0,17));write[i-first].splice(26,5,...input.slice(26,31));}
   for(const i of delta.clear)write[i-first]=Array(31).fill('');
   for(const i of delta.fresh){const row=offset+i+1;write[i-first][17]='=IF(A'+row+'>0,ISOWEEKNUM(A'+row+'),"")';write[i-first][18]=write[i-first][17];}
   try{
    phase='writing';stage('Writing '+p.rows.length+' Daily Report rows');
    sheet.getRange(offset+first+1,28,count,4).setNumberFormat('@');
    dailyWriteBlocks(sheet,offset+first+1,write,1);
    sheet.getRange(offset+first+1,1,count,1).setNumberFormat('yyyy-mm-dd');
    SpreadsheetApp.flush();phase='committed';
   }catch(e){
    try{dailyWriteBlocks(sheet,offset+first+1,snapshot,1);SpreadsheetApp.flush();phase='restored';log.getRange(n,8).setValue('FAILED — restored');log.getRange(n,13).setValue(String(e.message).slice(0,400));}
    catch(restoreError){throw Error('Pemulihan belum terkonfirmasi. Backup: '+journalName+'. '+restoreError.message);}
    throw Error('Daily Report dipulihkan setelah import gagal. '+e.message);
   }
   // Native row sorting carries formulas, labels and account IDs together. No rollback by old row numbers after sorting.
   stage('Sorting '+(delta.grid.length-1)+' affected rows');log.getRange(n,12,1,2).setValues([[seconds(),'Data written; sorting rows '+(offset+2)+'–'+(offset+delta.grid.length)+'. '+timings.join('; ')]]);
   sheet.getRange(offset+2,1,delta.grid.length-1,31).sort([{column:1,ascending:true},{column:3,ascending:true},{column:4,ascending:true}]);
   const filter=sheet.getFilter();if(filter)filter.remove();sheet.getRange(1,1,offset+delta.count+1,31).createFilter();sheet.setFrozenRows(1);
  }
  stage('Finalizing import');
  log.getRange(n,12,1,2).setValues([[seconds(),'Finalizing. '+timings.join('; ')]]);SpreadsheetApp.flush();
  const duration=seconds(),message='Import completed: '+p.rows.length+' baris diperiksa; '+delta.changes.length+' diperbarui, '+delta.clear.length+' baris lama diganti. '+DAILY_TAB+' berisi '+(window.prefixCount+delta.count)+' baris. '+duration+' detik.';
  log.getRange(n,8).setValue('SUCCESS');log.getRange(n,12,1,2).setValues([[duration,(affected.length?'Completed; affected dates sorted. ':'Verified: data already identical. ')+timings.join('; ')]]);
  job.state='SUCCESS';job.elapsedSeconds=duration;job.message=message;saveImportJob_(job);return message;
 }catch(error){if(job){job.state=['beforeWrite','restored'].includes(phase)?'FAILED':'UNCONFIRMED';job.message=String(error.message).slice(0,600);try{saveImportJob_(job);}catch(ignore){}}throw error;
 }finally{try{if(job&&importProperties_().getProperty(IMPORT_ACTIVE)===job.requestId)importProperties_().deleteProperty(IMPORT_ACTIVE);}finally{lock.releaseLock();}}
}

function refreshMetrics(){const lock=LockService.getDocumentLock();lock.waitLock(30000);try{const sheet=book().getSheetByName('Raw Data'),data=sheet.getDataRange().getValues();sheet.getRange(1,1,data.length,data[0].length).setValues(populateFormulas(safeValues(data)));SpreadsheetApp.flush();book().toast('Metrics diperbarui.');}finally{lock.releaseLock();}}
const UPLOAD_HTML="<!doctype html><html lang=\"id\"><meta charset=\"utf-8\"><style>\nbody{font:14px/1.5 Arial,sans-serif;color:#193c32;padding:8px 16px;background:#f7f9f6}h2{margin:4px 0 8px}p{margin:8px 0;color:#54665e}label{display:block;margin:12px 0 4px}select,input{box-sizing:border-box;width:100%;padding:9px;border:1px solid #cbd6ce;border-radius:6px;background:white;color:#193c32}.dates{display:flex;gap:12px}.dates label{flex:1}.buttons{display:flex;gap:10px;margin-top:18px}button{padding:10px 18px;border:1px solid #b8cbbf;border-radius:7px;background:white;cursor:pointer;font-weight:bold}#apply{background:#245b47;color:white}button:disabled{opacity:.45;cursor:default}.status{margin-top:18px;padding:14px;border:1px solid #d4ddd5;border-radius:8px;background:white}.status.success{background:#e5f4e9;border-color:#6ca980}.status.warning{background:#fff9e9;border-color:#d6b768}.status.error{background:#fff0ed;border-color:#c67d70}#heading{font-weight:bold;font-size:16px}#details{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 Arial;margin:8px 0 0}progress{display:block;width:100%;height:12px;margin-top:10px;accent-color:#29774f}progress[hidden],[hidden]{display:none!important}#elapsed{font-size:12px;color:#586c60;margin-top:8px}#hint{font-size:12px}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #81ae91;outline-offset:2px}\n</style><body><h2 id=\"title\">Import Meta Ads</h2><p id=\"intro\">Upload CSV export Meta dengan breakdown Day.</p><p>Tunggu pesan <b>Import completed</b> sebelum menutup jendela.</p>\n<p id=\"destination\">Destination: Raw Data → Dashboard.</p>\n<label for=\"source\">Source</label><select id=\"source\"><option>SE Main</option><option>SE Secondary</option><option>SE Third</option><option>SLSA</option><option>Daily Report</option></select>\n<label for=\"file\">CSV file</label><input id=\"file\" type=\"file\" accept=\".csv\">\n<label for=\"mode\">Mode</label><select id=\"mode\"><option value=\"upsert\">Update ads in file</option><option value=\"replace\">Replace complete source / date range</option></select>\n<div class=\"dates\"><label>Start date<input type=\"date\" id=\"start\"></label><label>End date<input type=\"date\" id=\"end\"></label></div>\n<div class=\"buttons\"><button id=\"preview\" onclick=\"preview()\">Preview</button><button id=\"apply\" disabled onclick=\"apply()\">Import</button><button id=\"check\" hidden onclick=\"checkStatus()\">Check status</button></div>\n<section id=\"status\" class=\"status\" aria-busy=\"false\"><div id=\"heading\" role=\"status\" aria-live=\"polite\">Ready to preview</div><progress id=\"progress\" max=\"100\" hidden aria-label=\"Import progress\"></progress><div id=\"elapsed\" hidden></div><pre id=\"details\">Pilih sumber dan file, lalu klik Preview.</pre><p id=\"hint\"></p></section>\n<script>\nlet text='',token='',requestId='',busy=false,timer=null,pollTimer=null,checking=false,started=0,stage='idle',submissionPending=false;\nconst el=id=>document.getElementById(id);\nfunction lock(value){busy=value;document.querySelectorAll('input,select').forEach(e=>e.disabled=value);el('preview').disabled=value;el('apply').disabled=value||!token;el('status').setAttribute('aria-busy',String(value));}\nfunction show(kind,title,details,hint=''){el('status').className='status '+kind;el('heading').textContent=title;el('details').textContent=details;el('hint').textContent=hint;el('check').hidden=!requestId||['idle','read','preview','success'].includes(stage);}\nfunction tick(){const seconds=Math.floor((Date.now()-started)/1000);el('elapsed').textContent='Elapsed: '+Math.floor(seconds/60)+'m '+seconds%60+'s';if(stage==='import'&&seconds>=360)el('hint').textContent='Menunggu konfirmasi Import ID ini. Jangan impor ulang. Status diperiksa otomatis; jika tetap belum selesai, periksa Apps Script → Executions.';else if(stage==='import'&&el('source').value==='Daily Report'&&seconds>=120)el('hint').textContent='Target 2 menit terlewati. Proses belum dikonfirmasi selesai; tahap terakhir ditampilkan di atas. Jangan impor ulang selama proses berjalan.';}\nfunction begin(next,title,description){stage=next;started=Date.now();clearInterval(timer);lock(true);show('',title,description);el('progress').hidden=false;el('progress').removeAttribute('value');el('elapsed').hidden=false;tick();timer=setInterval(tick,1000);}\nfunction stop(){clearInterval(timer);clearTimeout(pollTimer);timer=null;pollTimer=null;lock(false);}\nfunction sourceHelp(){const daily=el('source').value==='Daily Report';el('title').textContent=daily?'Import Daily Report':'Import Meta Ads';el('intro').textContent=daily?'Upload export harian dengan calendar_date. Data mulai 1 Juli 2026.':'Upload CSV export Meta dengan breakdown Day.';el('destination').textContent=daily?'Destination: Copy of Daily Report → Leads / Booking dashboard.':'Destination: Raw Data → Dashboard. Tab Import hanya untuk paste manual.';el('mode').options[0].textContent=daily?'Update ad / dates in file':'Update ads in file';el('mode').options[1].textContent=daily?'Replace all centers / date range':'Replace complete source / date range';}\nfunction changed(){if(busy)return;stop();sourceHelp();requestId='';token='';stage='idle';el('apply').disabled=true;el('progress').hidden=true;el('elapsed').hidden=true;show('','Ready to preview','Pilihan berubah. Klik Preview untuk memeriksa file.');}\ndocument.querySelectorAll('input,select').forEach(e=>e.addEventListener('change',changed));\nsourceHelp();\nfunction completed(r){\n token='';submissionPending=false;stop();stage='success';el('progress').hidden=false;el('progress').value=100;\n show('success','✓ Import completed · 100%',r.message||'Data tersimpan.',`Import ID: ${requestId}. SUCCESS terkonfirmasi untuk impor ini. Anda boleh menutup jendela atau mengimpor account berikutnya.`);\n}\nfunction scheduleCheck(delay=5000){clearTimeout(pollTimer);if(['import','busy','checking'].includes(stage))pollTimer=setTimeout(()=>checkStatus(),delay);}\nfunction receiveStatus(r){\n if(!r||r.requestId!==requestId||stage==='success')return;\n if(r.state==='SUCCESS'&&r.done===true){completed(r);return;}\n if(r.state==='FAILED'){token='';submissionPending=false;stop();stage='error';el('progress').hidden=true;show('error','Import failed',r.message||'Periksa Import Log.',`Import ID: ${requestId}`);return;}\n if(stage==='busy'&&!submissionPending&&r.ready&&r.state==='NOT_STARTED'){\n  stop();stage='preview';el('progress').hidden=true;show('','Ready to import','Importer sudah tersedia. File ini belum diimpor.','Klik Import untuk melanjutkan; Preview sebelumnya tetap valid.');return;\n }\n if(r.state==='RUNNING'){\n  stage='import';lock(true);show('','Import in progress',r.stage||'Server sedang memproses impor.',`Import ID: ${requestId}`);scheduleCheck();return;\n }\n if(r.state==='UNCONFIRMED'||(!submissionPending&&stage==='checking'&&r.state==='NOT_STARTED')){\n  token='';stop();stage='unconfirmed';el('progress').hidden=true;show('warning','Status needs checking',r.message||'Belum ada konfirmasi untuk Import ID ini.','Gunakan Check status atau periksa Import Log / Executions sebelum mengulang.');return;\n }\n if(r.state==='BUSY')show('warning',submissionPending?'Waiting for importer':'Importer busy',r.activeSource?`Proses ${r.activeSource} sedang memakai importer.`:'Importer sedang dipakai proses lain.',submissionPending?'Permintaan sedang diperiksa.': 'File ini belum diimpor. Menunggu importer tersedia; tidak ada penulisan ulang otomatis.');\n scheduleCheck();\n}\nfunction checkStatus(){\n if(!requestId||checking||stage==='success')return;const id=requestId;checking=true;el('check').disabled=true;\n google.script.run.withSuccessHandler(r=>{checking=false;el('check').disabled=false;if(id===requestId)receiveStatus(r);})\n .withFailureHandler(e=>{checking=false;el('check').disabled=false;if(id!==requestId||stage==='success')return;el('hint').textContent='Pengecekan status belum terhubung. Gunakan Check status atau periksa Import Log / Executions. Import ID: '+id;scheduleCheck(10000);}).getImportStatus(id);\n}\nfunction failed(error,importing){\n const message=error&&error.message?error.message:String(error);\n if(importing&&requestId){submissionPending=false;stage='checking';lock(true);show('warning','Checking import status',message,'Memastikan hasil berdasarkan Import ID, bukan catatan sukses account lain.');checkStatus();scheduleCheck();return;}\n token='';stop();stage='error';el('progress').hidden=true;show('error','Preview failed',message,'Perbaiki file atau pilihan, lalu klik Preview lagi.');\n}\nfunction request(confirm){\n const importing=!!confirm,id=requestId;if(importing)submissionPending=true;\n google.script.run.withSuccessHandler(r=>{\n  if(id!==requestId||stage==='success')return;\n  if(importing){submissionPending=false;if(r?.state==='BUSY'){stage='busy';lock(true);receiveStatus(r);return;}if(r?.done===true&&r.requestId===id){completed(r);return;}failed(new Error('Server belum mengonfirmasi hasil impor ini.'),true);}\n  else{token=r.token||'';requestId=r.requestId||'';stop();stage='preview';el('apply').disabled=!token||!requestId;el('progress').hidden=true;show('','Preview ready — not imported yet',r.summary||'Tidak ada ringkasan.','Klik Import untuk menyimpan.');}\n }).withFailureHandler(e=>{if(id===requestId&&stage!=='success')failed(e,importing);}).uploadCsv(el('source').value,text,el('mode').value,el('start').value,el('end').value,confirm,id);\n}\nfunction preview(){\n if(busy)return;const file=el('file').files[0];if(!file){show('error','Choose a CSV file','Pilih file sebelum klik Preview.');return;}if(file.size>10000000){failed(new Error('File terlalu besar; bagi menjadi rentang tanggal lebih pendek.'),false);return;}\n token='';requestId='';begin('read','Reading file','Membaca '+file.name);const reader=new FileReader();\n reader.onprogress=e=>{if(e.lengthComputable){el('progress').value=e.loaded/e.total*100;el('heading').textContent='Reading file · '+Math.round(e.loaded/e.total*100)+'%';}};\n reader.onerror=()=>failed(new Error('File tidak dapat dibaca. Pilih file kembali.'),false);reader.onabort=()=>failed(new Error('Pembacaan file dibatalkan.'),false);\n reader.onload=()=>{text=reader.result;stage='preview';el('progress').removeAttribute('value');show('','Validating file','Memeriksa format, tanggal, dan identitas ad.');request('');};reader.readAsText(file);\n}\nfunction apply(){if(busy||!token||!requestId)return;begin('import','Import in progress','Memvalidasi dan menyimpan perubahan.');request(token);scheduleCheck();}\n\n</script></body></html>\n";

const FORMULAS = {"2": "=TRIM(REGEXREPLACE(B2,\"\\s*_\\s*\\d{1,2}/\\d{1,2}/\\d{2,4}$\",\"\"))", "4": "=IFERROR(TRIM(REGEXEXTRACT(D2,\"\\-\\s*(.+)\")),D2)", "27": "=IFERROR(U2/V2,\"\")", "28": "=IFERROR(X2/W2,\"\")", "29": "=IFERROR(Y2/V2,\"\")", "30": "=IF(AND(AV2<>\"\",AY2<>\"\"),IFNA(IF(COUNTIFS($AV$2:$AV,AV2,$AY$2:$AY,AY2,$F$2:$F,F2)>1,\"\",INDEX('Report Totals'!R:R,MATCH(AO2&\"|\"&TEXT(F2,\"yyyy-mm-dd\")&\"|\"&AV2&\"|\"&AY2,'Report Totals'!Q:Q,0))),IFNA(IF(COUNTIFS($AR$2:$AR,AR2,$AP$2:$AP,AP2)>1,\"\",INDEX('Report Totals'!N:N,MATCH(AR2&\"|\"&AP2,'Report Totals'!M:M,0))),IF(COUNTIF($AR$2:$AR,AR2)>1,\"\",IF($AO2=\"English\",IFNA(INDEX('Report Totals'!D:D,MATCH(TEXT(F2,\"yyyy-mm-dd\")&\"|\"&C2&\"|\"&E2,'Report Totals'!F:F,0)),\"\"),IFNA(INDEX('Report Totals'!J:J,MATCH(TEXT(F2,\"yyyy-mm-dd\")&\"|\"&C2&\"|\"&E2,'Report Totals'!L:L,0)),\"\"))))),IFNA(IF(COUNTIFS($AR$2:$AR,AR2,$AP$2:$AP,AP2)>1,\"\",INDEX('Report Totals'!N:N,MATCH(AR2&\"|\"&AP2,'Report Totals'!M:M,0))),IF(COUNTIF($AR$2:$AR,AR2)>1,\"\",IF($AO2=\"English\",IFNA(INDEX('Report Totals'!D:D,MATCH(TEXT(F2,\"yyyy-mm-dd\")&\"|\"&C2&\"|\"&E2,'Report Totals'!F:F,0)),\"\"),IFNA(INDEX('Report Totals'!J:J,MATCH(TEXT(F2,\"yyyy-mm-dd\")&\"|\"&C2&\"|\"&E2,'Report Totals'!L:L,0)),\"\")))))", "31": "=IF(AND(AV2<>\"\",AY2<>\"\"),IFNA(IF(COUNTIFS($AV$2:$AV,AV2,$AY$2:$AY,AY2,$F$2:$F,F2)>1,\"\",INDEX('Report Totals'!S:S,MATCH(AO2&\"|\"&TEXT(F2,\"yyyy-mm-dd\")&\"|\"&AV2&\"|\"&AY2,'Report Totals'!Q:Q,0))),IFNA(IF(COUNTIFS($AR$2:$AR,AR2,$AP$2:$AP,AP2)>1,\"\",INDEX('Report Totals'!O:O,MATCH(AR2&\"|\"&AP2,'Report Totals'!M:M,0))),IF(COUNTIF($AR$2:$AR,AR2)>1,\"\",IF($AO2=\"English\",IFNA(INDEX('Report Totals'!E:E,MATCH(TEXT(F2,\"yyyy-mm-dd\")&\"|\"&C2&\"|\"&E2,'Report Totals'!F:F,0)),\"\"),IFNA(INDEX('Report Totals'!K:K,MATCH(TEXT(F2,\"yyyy-mm-dd\")&\"|\"&C2&\"|\"&E2,'Report Totals'!L:L,0)),\"\"))))),IFNA(IF(COUNTIFS($AR$2:$AR,AR2,$AP$2:$AP,AP2)>1,\"\",INDEX('Report Totals'!O:O,MATCH(AR2&\"|\"&AP2,'Report Totals'!M:M,0))),IF(COUNTIF($AR$2:$AR,AR2)>1,\"\",IF($AO2=\"English\",IFNA(INDEX('Report Totals'!E:E,MATCH(TEXT(F2,\"yyyy-mm-dd\")&\"|\"&C2&\"|\"&E2,'Report Totals'!F:F,0)),\"\"),IFNA(INDEX('Report Totals'!K:K,MATCH(TEXT(F2,\"yyyy-mm-dd\")&\"|\"&C2&\"|\"&E2,'Report Totals'!L:L,0)),\"\")))))", "32": "=IFERROR(IF(AE2=\"\",\"\",P2/AE2),\"\")", "33": "=IFERROR(IF(AF2=\"\",\"\",P2/AF2),\"\")", "34": "=IFERROR(IF(AE2=\"\",\"\",AE2/R2),\"\")", "35": "=IFERROR(P2/SUMIFS($P$2:$P,$AN$2:$AN,AN2,$A$2:$A,A2,$B$2:$B,B2,$F$2:$F,F2),\"\")", "36": "=IF(F2>0,ISOWEEKNUM(F2),\"\")", "37": "=IFNA(INDEX('Creative Mapping'!F:F,MATCH(AS2,'Creative Mapping'!H:H,0)),IFNA(INDEX('Creative Mapping'!F:F,MATCH(AQ2,'Creative Mapping'!H:H,0)),\"\"))", "38": "=IFNA(INDEX('Creative Mapping'!G:G,MATCH(AS2,'Creative Mapping'!H:H,0)),IFNA(INDEX('Creative Mapping'!G:G,MATCH(AQ2,'Creative Mapping'!H:H,0)),\"\"))", "42": "=AN2&\"|\"&A2&\"|\"&B2&\"|\"&D2", "43": "=AO2&\"|\"&TEXT(F2,\"yyyy-mm-dd\")&\"|\"&C2&\"|\"&E2", "44": "=AQ2&\"|\"&TEXT(F2,\"yyyy-mm-dd\")"};
