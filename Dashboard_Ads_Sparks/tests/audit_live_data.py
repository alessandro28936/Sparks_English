"""Independent reconciliation of connector snapshots; no spreadsheet writes."""
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime, timedelta
import json, re, csv, math
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'.work/audit'
OUT=ROOT/'audit-results';OUT.mkdir(exist_ok=True)
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def chunks(prefix):
    result=[]
    for p in sorted(WORK.glob(prefix+'-[0-9]*.json'),key=lambda p:int(p.stem.split('-')[-1])):
        d=read(p)
        result.extend((d['start']+i,r) for i,r in enumerate(d['values']))
    return result
def n(v):
    if v is None or v=='':return None
    if isinstance(v,(float,int)):return v if math.isfinite(v) else None
    try:return float(v)
    except (ValueError,TypeError):return None
def at(r,i):return r[i] if len(r)>i else None
def day(v):
    if isinstance(v,(int,float)):return (datetime(1899,12,30)+timedelta(days=v)).strftime('%Y-%m-%d')
    return str(v or '')[:10]
def close(a,b):return (a is None and b is None) or (a is not None and b is not None and math.isclose(a,b,rel_tol=1e-7,abs_tol=1e-6))
allraw=chunks('raw');headers=allraw[0][1];raw=[(i,r+[None]*(51-len(r))) for i,r in allraw[1:] if at(r,1)]
lo=min(r[5] for i,r in raw);hi=max(r[5] for i,r in raw)
daily_all=chunks('daily')
early=chunks('daily-dates')
early_relevant=[(i,r) for i,r in early if isinstance(at(r,0),(int,float)) and lo<=r[0]<=hi]
assert not early_relevant, 'Need additional Daily Report ranges: '+str(early_relevant[:5])
daily=[(i,r+[None]*(16-len(r))) for i,r in daily_all if isinstance(at(r,0),(int,float)) and lo<=r[0]<=hi]
assert not read(WORK/'daily-accounts.json').get('values'), 'Explicit report account metadata must be incorporated'
assert len(read(WORK/'slsa.json').get('values',[]))==1, 'Include SLSA report rows'
reports=defaultdict(lambda:{'leads':0,'booking':0,'rows':[]})
bad_outcomes=[]
for i,r in daily:
    if not r[2] or not r[3]:continue
    aset=str(r[2]);acct='Third' if re.search(r'(^|_)TA($|_)',aset.strip()) else ''
    if acct and not aset.strip().startswith('ALLS-ENG-'):aset='ALLS-ENG-'+re.sub(r'^CL\.JU_','JU_',aset.strip())
    key='|'.join(['English',day(r[0]),aset,str(r[3])])+('|Third' if acct else '')
    for metric,col in [('leads',14),('booking',11)]:
        val=n(r[col])
        if val is None:bad_outcomes.append({'row':i,'metric':metric,'value':r[col]})
        reports[key][metric]+=val or 0
    reports[key]['rows'].append(i)
legacy_count=Counter(r[43] for i,r in raw)
account_count=Counter((r[43],r[41]) for i,r in raw)
id_count=Counter((r[47],r[50],r[5]) for i,r in raw if r[47] and r[50])
spend_sets=defaultdict(float)
for i,r in raw:spend_sets[(r[39],r[0],r[1],r[5])]+=n(r[15]) or 0
issues=[];mismatches=[];metric_checks=Counter();missing=Counter();byaccount=defaultdict(lambda:Counter());age=[]
def issue(row,r,kind,detail,expected=None,actual=None):
    d={'Raw Data row':row,'Date':day(r[5]),'Account':r[41],'Ad set':r[1],'Ad':r[3],'Issue':kind,'Detail':detail,'Expected':expected,'Actual':actual}
    issues.append(d);return d
for i,r in raw:
    acc=byaccount[r[41]];acc['rows']+=1;acc['spend']+=n(r[15]) or 0;acc['results']+=n(r[17]) or 0
    for metric,col in [('leads',30),('booking',31)]:
        if n(r[col]) is not None:acc[metric]+=n(r[col]);acc[metric+'_matched_rows']+=1
    legacy=r[43];scoped=legacy+'|'+str(r[41]);report=reports.get(scoped) or reports.get(legacy)
    if (r[47] and r[50] and id_count[(r[47],r[50],r[5])]>1) or account_count[(legacy,r[41])]>1:
        expected=None;why='Ambiguous ad match' if report else 'No matching report'
    elif scoped in reports:expected=reports[scoped];why='Matched account report'
    elif legacy_count[legacy]>1:expected=None;why='Ambiguous account match' if report else 'No matching report'
    else:expected=reports.get(legacy);why='Matched legacy report' if expected else 'No matching report'
    for metric,col in [('leads',30),('booking',31)]:
        want=expected[metric] if expected else None;actual=n(r[col]);metric_checks[metric]+=1
        if not close(want,actual):mismatches.append(issue(i,r,'Outcome mismatch',metric,want,actual))
    if n(r[30]) is None or n(r[31]) is None:
        missing[(r[41],why)]+=1;issue(i,r,why,'Leads / Booking; report rows '+str(report['rows'] if report else []))
    ratios=[('CPR',18,15,17),('CPL',32,15,30),('CPB',33,15,31),('Results to Leads',34,30,17),('CTR',29,24,21),('Hook Rate',27,20,21),('Views Rate',28,23,22)]
    for label,out,num,den in ratios:
        a=n(r[num]);b=n(r[den]);want=a/b if a is not None and b is not None and b>0 else None
        # Sheets treats an empty additional-metric numerator as zero.
        if label in ['CTR','Hook Rate','Views Rate'] and a is None and b and b>0:want=0
        actual=n(r[out]);metric_checks[label]+=1
        if not close(want,actual):mismatches.append(issue(i,r,'Metric mismatch',label,want,actual))
    denom=spend_sets[(r[39],r[0],r[1],r[5])];want=(n(r[15]) or 0)/denom if denom else None
    metric_checks['Spend share']+=1
    if not close(want,n(r[35])):mismatches.append(issue(i,r,'Metric mismatch','Spend share',want,n(r[35])))
    generated='|'.join([str(r[40]),day(r[5]),str(r[2]),str(r[4])])
    if generated!=r[43]:mismatches.append(issue(i,r,'Identity mismatch','Report Key',generated,r[43]))
    if n(r[34]) is not None and r[34]>1:issue(i,r,'Rate above 100%','Leads exceed Results',None,r[34])
    pub=re.match(r'^(\d{1,2})/(\d{1,2})/(\d{2,4})\s*-',str(r[3]))
    if pub:
        d,m,y=map(int,pub.groups());y+=2000 if y<100 else 0
        try:
            if datetime(y,m,d).strftime('%Y-%m-%d')>day(r[5]):age.append(issue(i,r,'Publish date after data date','Check the date prefix against Meta publish date'))
        except ValueError:age.append(issue(i,r,'Invalid publish date','Check the ad name date prefix'))
dupes=defaultdict(list)
for i,r in raw:
    identity=(r[39],r[47],r[50],r[5]) if r[50] else (r[39],r[0],r[1],r[3],r[5])
    dupes[identity].append(i)
raw_duplicates=[v for v in dupes.values() if len(v)>1]
report_dupes=defaultdict(list)
for i,r in daily:report_dupes[json.dumps(r,ensure_ascii=False)].append(i)
report_duplicates=[{'rows':v,'data':json.loads(k)} for k,v in report_dupes.items() if len(v)>1]
dup_leads=sum((len(d['rows'])-1)*(n(d['data'][14]) or 0) for d in report_duplicates)
dup_booking=sum((len(d['rows'])-1)*(n(d['data'][11]) or 0) for d in report_duplicates)
scoped=read(WORK/'totals-scoped.json')['values'][1:];scoped_mismatches=[]
for r in scoped:
    if not at(r,0):continue
    key=r[0];parts=key.split('|')
    if not (day(lo)<=parts[1]<=day(hi)):continue
    e=reports.get(key)
    if not e or not close(e['leads'],n(at(r,1))) or not close(e['booking'],n(at(r,2))):scoped_mismatches.append({'key':key,'actual':r,'expected':e})
summary={'period':[day(lo),day(hi)],'raw_rows':len(raw),'daily_report_rows_in_period':len(daily),'daily_report_dates_scanned':len(early)+len(daily_all),'earlier_relevant_rows':len(early_relevant),'accounts':byaccount,'metric_checks':metric_checks,'outcome_and_metric_mismatches':len(mismatches),'missing':[{'account':a,'reason':b,'rows':c} for (a,b),c in missing.items()],'raw_duplicate_groups':len(raw_duplicates),'raw_name_collision_groups':sum(1 for v in Counter((r[39],r[0],r[1],r[3],r[5]) for i,r in raw).values() if v>1),'report_exact_duplicate_groups':len(report_duplicates),'report_duplicate_extra_rows':sum(len(d['rows'])-1 for d in report_duplicates),'identical_report_rows_confirmed_additional':True,'confirmed_additional_leads':dup_leads,'confirmed_additional_booking':dup_booking,'invalid_report_outcome_cells':len(bad_outcomes),'scoped_report_total_mismatches':len(scoped_mismatches),'publish_date_issues':len(age),'day_range_mismatches':sum(1 for i,r in raw if r[5]!=r[25] or r[5]!=r[26]),'invalid_week_numbers':sum(1 for i,r in raw if r[36]!=(datetime(1899,12,30)+timedelta(days=r[5])).isocalendar().week),'unsafe_numeric_ids':sum(1 for i,r in raw for c in [47,48,49,50] if isinstance(r[c],(int,float)) and abs(r[c])>2**53),'negative_metrics':sum(1 for i,r in raw for c in [15,17,19,20,21,22,23,24,30,31] if n(r[c]) is not None and n(r[c])<0)}
(OUT/'audit-summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')
(WORK/'audit-detail.json').write_text(json.dumps({'mismatches':mismatches,'report_duplicates':report_duplicates,'raw_duplicates':raw_duplicates,'bad_outcomes':bad_outcomes,'scoped_mismatches':scoped_mismatches},ensure_ascii=False),encoding='utf-8')
with (OUT/'rows-to-review.csv').open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.DictWriter(f,fieldnames=['Raw Data row','Date','Account','Ad set','Ad','Issue','Detail','Expected','Actual']);w.writeheader();w.writerows(issues)
print(json.dumps(summary,indent=2))
print('FIRST MISMATCHES',json.dumps(mismatches[:10]))
print('FIRST DUPLICATES',json.dumps(report_duplicates[:3]))
