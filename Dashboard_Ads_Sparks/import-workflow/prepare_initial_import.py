import json,re,datetime,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'.work'
old=json.loads((WORK/'raw-values.json').read_text()); headers=old[0][:39]
base=datetime.date(1899,12,30)
def day(v):
 if isinstance(v,(float,int)):return (base+datetime.timedelta(days=v)).isoformat()
 return str(v or '')[:10]
def serial(v):return (datetime.date.fromisoformat(day(v))-base).days
secondary_rows=json.loads((WORK/'Draft-Dashboar-3.json').read_text())[1:]
secondary_sets={(r[0],r[1]) for r in secondary_rows}
def source(r):
 if re.search(r'(^|[^A-Z0-9])SLSA($|[^A-Z0-9])',str(r.get('Ad set name',''))+' '+str(r.get('Campaign name','')),re.I):return 'SLSA'
 return 'SE Secondary' if (r.get('Campaign name'),r.get('Ad set name')) in secondary_sets or str(r.get('Ad set name','')).split('_')[0] in ['TBT','TCT'] else 'SE Main'
def entity(r):return '|'.join(str(r.get(k) or '') for k in ['Import Source','Campaign name','Ad set name','Ad name'])
def key(r):return entity(r)+'|'+day(r['Day'])
oldrows=[]
for a in old[1:]:
 if not a or not a[0]:continue
 r=dict(zip(headers,a));r['Import Source']=source(r);r['Day']=day(r['Day']);oldrows.append(r)
imports={};issues=[]
for name,src in [('Draft-Dashboard','SE Main'),('Draft-Dashboar-3','SE Secondary')]:
 a=json.loads((WORK/(name+'.json')).read_text());rr=[dict(zip(a[0],v)) for v in a[1:]]
 for r in rr:r['Import Source']=src
 imports[src]=rr
# Keep duplicate export rows exactly as supplied. They are identified in Import Issues;
# no assumption that two rows with the same names identify the same Meta ad.
for src,rr in imports.items():
 group=collections.defaultdict(list)
 for r in rr:group[key(r)].append(r)
 for k,v in group.items():
  if len(v)>1:issues.append(['DUPLICATE EXPORT IDENTITY',src,k,len(v),'Baris dipertahankan; jangan dijumlahkan sebagai ad tunggal tanpa Ad ID. Export ulang dengan Ad ID untuk membedakan.'])
periods={s:(min(day(r['Day']) for r in rr),max(day(r['Day']) for r in rr)) for s,rr in imports.items()}
keep=[r for r in oldrows if not(r['Import Source'] in periods and periods[r['Import Source']][0]<=r['Day']<=periods[r['Import Source']][1])]
merged=keep+[r for rr in imports.values() for r in rr]
merged.sort(key=lambda r:(day(r['Day']),r['Import Source'],r['Campaign name'],r['Ad set name'],r['Ad name']))
# Preserve EVERY existing dated label. Defaults only filled when one nonblank pair exists.
mg=collections.defaultdict(list)
for r in oldrows:mg[entity(r)].append(r)
for r in merged:mg.setdefault(entity(r),[])
mapping=[['Import Source','Campaign name','Ad set name','Ad name','Date override (optional)','Key Message Content','Content Pillar','Lookup key','Notes']]
for ek,rr in sorted(mg.items()):
 r=rr[0] if rr else next(x for x in merged if entity(x)==ek)
 vals={(x.get('Key Message Content') or '',x.get('Content Pillar') or '') for x in rr if x.get('Key Message Content') or x.get('Content Pillar')}
 prefix=[r['Import Source'],r['Campaign name'],r['Ad set name'],r['Ad name']]
 pair=next(iter(vals)) if len(vals)==1 else ('','')
 mapping.append(prefix+['',*pair,ek,'Isi F dan G. Berlaku untuk semua tanggal kecuali override.'])
 if len(vals)>1:
  issues.append(['MAPPING CONFLICT',r['Import Source'],ek,len(vals),'Label per tanggal dipertahankan; isi default setelah memeriksa creative.'])
  for x in rr:
   if x.get('Key Message Content') or x.get('Content Pillar'):mapping.append(prefix+[x['Day'],x.get('Key Message Content') or '',x.get('Content Pillar') or '',key(x),'Label historis; prioritas atas default.'])
extra=['Import Source','Brand','Account Group','Entity Key','Report Key','Row Key','Import Note','Imported At','Account ID','Campaign ID','Ad Set ID','Ad ID']
newheaders=headers+extra
rows=[newheaders]
for r in merged:
 s=r['Import Source'];v=[r.get(h) for h in headers]
 for idx in [5,25,26]:v[idx]=serial(r.get(headers[idx]) or r['Day'])
 # Derived fields are filled by native formulas below.
 for idx in [2,4,*range(27,39)]:v[idx]=None
 v += [s,'SLSA' if s=='SLSA' else 'English','Main' if s=='SE Main' else 'Secondary',None,None,None,'Legacy source matched to export ad sets; otherwise inferred from naming' if r in keep else 'Imported export; IDs unavailable','2026-11-04',None,None,None,None]
 rows.append(v)
# English Daily Report remains existing authoritative source; SLSA uses its own report.
report='''=QUERY(ARRAYFORMULA({'Copy of Daily Report'!A2:A,'Copy of Daily Report'!C2:C,'Copy of Daily Report'!D2:D,IFERROR(VALUE('Copy of Daily Report'!O2:O),0),IFERROR(VALUE('Copy of Daily Report'!L2:L),0)}),"select Col1,Col2,Col3,sum(Col4),sum(Col5) where Col1 is not null and Col2 is not null and Col3 is not null group by Col1,Col2,Col3 label sum(Col4) '',sum(Col5) ''",0)'''
reportS='''=IFERROR(QUERY('Daily Report SLSA'!A2:E,"select A,B,C,sum(D),sum(E) where A is not null group by A,B,C label sum(D) '',sum(E) ''",0),"")'''
# Native cell helpers.
def cv(v):
 if v is None or v=='':return {}
 if isinstance(v,bool):return {'userEnteredValue':{'boolValue':v}}
 if isinstance(v,(int,float)):return {'userEnteredValue':{'numberValue':v}}
 return {'userEnteredValue':{'formulaValue' if str(v).startswith('=') else 'stringValue':str(v)}}
def block(sid,data,start=0):
 width=max(map(len,data));return {'updateCells':{'range':{'sheetId':sid,'startRowIndex':start,'endRowIndex':start+len(data),'startColumnIndex':0,'endColumnIndex':width},'rows':[{'values':[cv(v) for v in r]+[{}]*(width-len(r))} for r in data],'fields':'userEnteredValue'}}
requests=[]
for sid,name in [(2026110402,'Draft-Dashboard'),(2026110403,'Draft-Dashboar-3')]:
 data=json.loads((WORK/(name+'.json')).read_text())
 for n in range(0,len(data),400):requests.append(block(sid,data[n:n+400],n))
requests.append(block(2026110404,json.loads((WORK/'Draft-Dashboard.json').read_text())[:1]))
for n in range(0,len(mapping),400):requests.append(block(2026110405,mapping[n:n+400],n))
requests.append(block(2026110407,[['Issue','Source','Identity','Count','Action']]+issues))
requests.append(block(2026110409,[['Day','Ad set trim','Ad Trim','Leads','Booking']]))
requests.append(block(2026110408,[['Day','Ad set trim','Ad Trim','Leads','Booking','Lookup key','SLSA Day','SLSA Ad set trim','SLSA Ad Trim','SLSA Leads','SLSA Booking','SLSA Lookup key']]))
requests.append({'updateCells':{'start':{'sheetId':2026110408,'rowIndex':1,'columnIndex':0},'rows':[{'values':[cv(report)]}],'fields':'userEnteredValue'}})
requests.append({'updateCells':{'start':{'sheetId':2026110408,'rowIndex':1,'columnIndex':6},'rows':[{'values':[cv(reportS)]}],'fields':'userEnteredValue'}})
for col,f in [(5,'=ARRAYFORMULA(IF(A2:A="","",TEXT(A2:A,"yyyy-mm-dd")&"|"&B2:B&"|"&C2:C))'),(11,'=ARRAYFORMULA(IF(G2:G="","",TEXT(G2:G,"yyyy-mm-dd")&"|"&H2:H&"|"&I2:I))')]:requests.append({'updateCells':{'start':{'sheetId':2026110408,'rowIndex':1,'columnIndex':col},'rows':[{'values':[cv(f)]}],'fields':'userEnteredValue'}})
for n in range(0,len(rows),400):requests.append(block(2026110410,rows[n:n+400],n))
# Formulas anchored row 2; repeatCell adjusts relative refs for each destination.
formulas={
2:'=TRIM(REGEXREPLACE(B2,"\\s*_\\s*\\d{1,2}/\\d{1,2}/\\d{2,4}$",""))',
4:'=IFERROR(TRIM(REGEXEXTRACT(D2,"\\-\\s*(.+)")),D2)',
27:'=IFERROR(U2/V2,"")',28:'=IFERROR(X2/W2,"")',29:'=IFERROR(Y2/V2,"")',
30:'=IF(COUNTIF($AR$2:$AR,AR2)>1,"",IF($AO2="English",IFNA(INDEX(\'Report Totals\'!D:D,MATCH(TEXT(F2,"yyyy-mm-dd")&"|"&C2&"|"&E2,\'Report Totals\'!F:F,0)),""),IFNA(INDEX(\'Report Totals\'!J:J,MATCH(TEXT(F2,"yyyy-mm-dd")&"|"&C2&"|"&E2,\'Report Totals\'!L:L,0)),"")))',
31:'=IF(COUNTIF($AR$2:$AR,AR2)>1,"",IF($AO2="English",IFNA(INDEX(\'Report Totals\'!E:E,MATCH(TEXT(F2,"yyyy-mm-dd")&"|"&C2&"|"&E2,\'Report Totals\'!F:F,0)),""),IFNA(INDEX(\'Report Totals\'!K:K,MATCH(TEXT(F2,"yyyy-mm-dd")&"|"&C2&"|"&E2,\'Report Totals\'!L:L,0)),"")))',
32:'=IFERROR(IF(AE2="","",P2/AE2),"")',33:'=IFERROR(IF(AF2="","",P2/AF2),"")',34:'=IFERROR(IF(AE2="","",AE2/R2),"")',
35:'=IFERROR(P2/SUMIFS($P$2:$P,$AN$2:$AN,AN2,$A$2:$A,A2,$B$2:$B,B2,$F$2:$F,F2),"")',
36:'=IF(F2>0,ISOWEEKNUM(F2),"")',
37:'=IFNA(INDEX(\'Creative Mapping\'!F:F,MATCH(AS2,\'Creative Mapping\'!H:H,0)),IFNA(INDEX(\'Creative Mapping\'!F:F,MATCH(AQ2,\'Creative Mapping\'!H:H,0)),""))',
38:'=IFNA(INDEX(\'Creative Mapping\'!G:G,MATCH(AS2,\'Creative Mapping\'!H:H,0)),IFNA(INDEX(\'Creative Mapping\'!G:G,MATCH(AQ2,\'Creative Mapping\'!H:H,0)),""))',
42:'=AN2&"|"&A2&"|"&B2&"|"&D2',43:'=AO2&"|"&TEXT(F2,"yyyy-mm-dd")&"|"&C2&"|"&E2',44:'=AQ2&"|"&TEXT(F2,"yyyy-mm-dd")'}
for col,f in formulas.items():requests.append({'repeatCell':{'range':{'sheetId':2026110410,'startRowIndex':1,'endRowIndex':len(rows),'startColumnIndex':col,'endColumnIndex':col+1},'cell':cv(f),'fields':'userEnteredValue'}})
# Mapping key stays live when user adds or changes a mapping.
requests.append({'repeatCell':{'range':{'sheetId':2026110405,'startRowIndex':1,'endRowIndex':3000,'startColumnIndex':7,'endColumnIndex':8},'cell':cv('=IF(A2="","",A2&"|"&B2&"|"&C2&"|"&D2&IF(E2="","","|"&IF(ISNUMBER(E2),TEXT(E2,"yyyy-mm-dd"),E2)))'),'fields':'userEnteredValue'}})
log=[['Imported At','Source','File','Start','End','Imported rows','Removed old rows','Status','Mode']]
for src,rr in imports.items():log.append(['2026-11-04',src,'Draft-Dashboard.xlsx' if src=='SE Main' else 'Draft-Dashboar-3.xlsx',*periods[src],len(rr),sum(r['Import Source']==src and periods[src][0]<=r['Day']<=periods[src][1] for r in oldrows),'PREVIEW','Replace complete source/date range'])
requests.append(block(2026110406,log))
(WORK/'import-requests.json').write_text(json.dumps(requests),encoding='utf-8')
(WORK/'import-plan.json').write_text(json.dumps({'old':len(oldrows),'retained':len(keep),'new':len(merged),'mapping':len(mapping)-1,'issues':issues,'periods':periods,'spend':{s:sum(float(r.get('Amount spent (IDR)') or 0) for r in rr) for s,rr in imports.items()},'formulas':formulas,'headers':newheaders,'rows':rows}),encoding='utf-8')
print(json.dumps({'old':len(oldrows),'retained':len(keep),'new':len(merged),'mapping':len(mapping)-1,'issues':len(issues),'requests':len(requests)}))
