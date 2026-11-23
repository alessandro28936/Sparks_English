const SLSA_DAILY_TAB='SLSA Daily Report';
const SLSA_META_CHANNEL='SLSA - Meta';
const SLSA_DAILY_HEADERS=['Sub-Channel','Tanggal Leads Submitted','Leads Status','Branch','Date Booking','Campaign','Tanggal Chat/Leads Masuk'];

function slsaHeader(value){
 return String(value??'').replace(/\s+/g,' ').replace(/\s*\/\s*/g,'/').trim().toLowerCase();
}

function slsaReportDate(value,header,row,optional=false){
 if(value==null||String(value).trim()===''){
  if(optional)return '';
  throw Error(header+' kosong pada baris '+row+'.');
 }
 if(typeof value==='number'&&Number.isFinite(value)&&value>0)return value;
 const text=value instanceof Date
  ? Utilities.formatDate(value,'Asia/Jakarta','yyyy-MM-dd HH:mm:ss')
  : String(value).trim();
 const iso=text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
 if(iso){
  const [,day,h='0',m='0',s='0']=iso;
  if(+h<24&&+m<60&&+s<60)return serialDate(day)+(+h*3600+ +m*60+ +s)/86400;
 }
 const english=text.match(/^([A-Za-z]{3,9}) (\d{1,2}),? (\d{4})$/);
 if(english){
  const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const month=months.findIndex(name=>[name,name.slice(0,3)].includes(english[1].toLowerCase()));
  if(month>=0)return serialDate(english[3]+'-'+String(month+1).padStart(2,'0')+'-'+english[2].padStart(2,'0'));
 }
 throw Error('Tanggal tidak valid pada '+header+', baris '+row+'. Gunakan yyyy-mm-dd atau yyyy-mm-dd hh:mm:ss (WIB).');
}

function prepareSlsaDaily(data,mode,start,end){
 if(mode!=='replace')throw Error('Gunakan Replace submitted dates untuk file SLSA Daily Report.');
 const keys=SLSA_DAILY_HEADERS.map(slsaHeader),header=(data[0]||[]).map(slsaHeader);
 const columns=keys.map(key=>header.indexOf(key));
 if(columns.some(i=>i<0)||new Set(header.filter(Boolean)).size!==header.filter(Boolean).length){
  throw Error('Header SLSA Daily Report perlu memuat '+SLSA_DAILY_HEADERS.join(', ')+'.');
 }
 const rows=[];
 for(let i=1;i<data.length;i++){
  const input=data[i];
  if(input.every(value=>String(value??'').trim()===''))continue;
  if(columns.every((column,j)=>slsaHeader(input[column])===keys[j]))continue;
  const row=columns.map(column=>String(input[column]??'').trim());
  if(row[0].toLowerCase()!==SLSA_META_CHANNEL.toLowerCase()){
   throw Error('Sub-Channel pada baris '+(i+1)+' harus '+SLSA_META_CHANNEL+'.');
  }
  row[0]=SLSA_META_CHANNEL;
  row[1]=slsaReportDate(row[1],SLSA_DAILY_HEADERS[1],i+1);
  row[4]=slsaReportDate(row[4],SLSA_DAILY_HEADERS[4],i+1,true);
  row[6]=slsaReportDate(row[6],SLSA_DAILY_HEADERS[6],i+1);
  rows.push(row);
 }
 if(!rows.length)throw Error('Tidak ada baris SLSA Daily Report untuk diimpor.');
 const dates=[...new Set(rows.map(r=>dateKey(Math.floor(r[1]))))].sort();
 start=start?dateKey(start):dates[0];
 end=end?dateKey(end):dates.at(-1);
 if(start!==dates[0]||end!==dates.at(-1))throw Error('Rentang harus sama dengan tanggal submitted pertama dan terakhir pada file.');
 const fingerprint=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([SLSA_DAILY_TAB,start,end,rows])));
 return {source:SLSA_DAILY_TAB,rows,mode,start,end,fingerprint};
}

function slsaDailyPlan(sheet,plan){
 const existing=sheet.getRange(1,1,Math.max(1,sheet.getLastRow()),7).getValues();
 if(!SLSA_DAILY_HEADERS.every((key,i)=>slsaHeader(key)===slsaHeader(existing[0][i])))throw Error('Header SLSA Daily Report berubah.');
 const first=serialDate(plan.start),last=serialDate(plan.end);
 const retained=[];
 let replaced=0;
 for(let i=1;i<existing.length;i++){
  const row=existing[i];
  if(row.every(value=>value===''||value==null))continue;
  if(slsaHeader(row[0])===slsaHeader(SLSA_META_CHANNEL)){
   const day=Math.floor(slsaReportDate(row[1],SLSA_DAILY_HEADERS[1],i+1));
   if(day>=first&&day<=last){replaced++;continue;}
  }
  retained.push(row);
 }
 return {retained,replaced};
}

function previewSlsaDaily(plan){
 const lock=LockService.getDocumentLock();
 if(!lock.tryLock(1))throw Error('Importer sedang digunakan. Coba Preview kembali setelah selesai.');
 try{
  const sheet=book().getSheetByName(SLSA_DAILY_TAB);
  if(!sheet)throw Error('Tab '+SLSA_DAILY_TAB+' tidak ditemukan.');
  const {replaced}=slsaDailyPlan(sheet,plan);
  const bookings=plan.rows.filter(r=>/^\s*booking\s*$/i.test(r[2])&&r[4]!=='').length;
  return plan.rows.length+' baris SLSA - Meta | Submitted '+plan.start+' s.d. '+plan.end+
   '\n'+bookings+' Booking dengan tanggal pada file.'+
   '\n'+replaced+' baris lama SLSA - Meta dalam rentang submitted akan diganti. Gunakan export lengkap untuk seluruh tanggal pada rentang tersebut.';
 }finally{lock.releaseLock();}
}

function commitSlsaDaily(plan){
 const lock=LockService.getDocumentLock(),started=Date.now();
 if(!lock.tryLock(1000)){const error=Error('Importer sedang dipakai proses lain.');error.code='IMPORT_BUSY';throw error;}
 let job=null,phase='beforeWrite';
 try{
  const id=importJobId_(plan.requestId),prior=readImportJob_(id);
  if(prior){
   if(prior.fingerprint!==plan.fingerprint||prior.source!==plan.source)throw Error('Import ID tidak cocok. Preview ulang.');
   if(prior.state==='SUCCESS')return prior.message;
   throw Error('Import ID sudah diproses. Periksa status.');
  }
  job={requestId:id,fingerprint:plan.fingerprint,source:plan.source,start:plan.start,end:plan.end,state:'RUNNING',stage:'Validating SLSA Daily Report'};
  saveImportJob_(job);importProperties_().setProperty(IMPORT_ACTIVE,id);pruneImportJobs_();
  const ss=book(),sheet=ss.getSheetByName(SLSA_DAILY_TAB),log=ss.getSheetByName('Import Log');
  if(!sheet)throw Error('Tab '+SLSA_DAILY_TAB+' tidak ditemukan.');
  const report=ss.getSheetByName('Daily Report SLSA');
  if(!report?.getRange('A2').getFormula().includes("'SLSA Daily Report'!"))throw Error('Ringkasan Daily Report SLSA belum terhubung ke tab sumber.');
  const {retained,replaced}=slsaDailyPlan(sheet,plan),oldCount=sheet.getLastRow()-1;
  const next=safeValues([...retained,...plan.rows]);
  // Each source row contributes at most one lead day and one booking day.
  ensureSize(report,next.length*2+1,6);
  // Write new rows and clear trailing cells together; keep the original sheet and header.
  while(next.length<oldCount)next.push(Array(7).fill(''));
  ensureSize(sheet,next.length+1,7);
  const logRow=log.getLastRow()+1;
  ensureSize(log,logRow,15);job.logRow=logRow;
  const stamp=Utilities.formatDate(new Date(),'Asia/Jakarta','yyyy-MM-dd HH:mm:ss');
  log.getRange(logRow,1,1,15).setValues([[stamp,plan.source,'CSV',plan.start,plan.end,plan.rows.length,replaced,'RUNNING',plan.mode,'','slsa-submitted-v1',0,'Writing SLSA Daily Report',id,plan.fingerprint]]);
  job.stage='Writing SLSA Daily Report';saveImportJob_(job);
  sheet.getRange(2,2,next.length,1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.getRange(2,5,next.length,1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2,7,next.length,1).setNumberFormat('yyyy-mm-dd');
  phase='writing';
  sheet.getRange(2,1,next.length,7).setValues(next);
  SpreadsheetApp.flush();phase='committed';
  const seconds=Math.round((Date.now()-started)/1000);
  const message='Import completed: '+plan.rows.length+' baris SLSA Daily Report. '+replaced+' baris lama diganti.';
  log.getRange(logRow,12,1,2).setValues([[seconds,message]]);
  log.getRange(logRow,8).setValue('SUCCESS');
  job.state='SUCCESS';job.message=message;saveImportJob_(job);return message;
 }catch(error){
  if(job){
   job.state=phase==='beforeWrite'?'FAILED':'UNCONFIRMED';
   job.message=String(error.message).slice(0,600);
   saveImportJob_(job);
  }
  throw error;
 }finally{
  try{if(job&&importProperties_().getProperty(IMPORT_ACTIVE)===job.requestId)importProperties_().deleteProperty(IMPORT_ACTIVE);}
  finally{lock.releaseLock();}
 }
}
