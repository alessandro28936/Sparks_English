"""Local Chromium QA via DevTools. Uses installed Chrome; no user browser profile."""
import asyncio
import base64
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request
import websockets

ROOT = Path(__file__).resolve().parents[1]
CHROME = Path(os.environ.get('PROGRAMFILES', r'C:\Program Files')) / 'Google/Chrome/Application/chrome.exe'
WORK = ROOT / '.work'

async def run():
    WORK.mkdir(exist_ok=True)
    server = subprocess.Popen(['python', '-m', 'http.server', '8811', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    browser = subprocess.Popen([str(CHROME), '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9271', '--remote-allow-origins=http://localhost:9271', '--user-data-dir='+str(WORK/'chrome-integrity-qa'), '--window-size=1512,1100', 'http://127.0.0.1:8811/Dashboard_ads.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    counter = 0
    errors = []
    try:
        targets = []
        for _ in range(50):
            try:
                targets = json.load(urllib.request.urlopen('http://127.0.0.1:9271/json', timeout=1))
                if any(t['type']=='page' for t in targets): break
            except Exception: pass
            await asyncio.sleep(.2)
        target = next(t for t in targets if t['type']=='page')
        async with websockets.connect(target['webSocketDebuggerUrl'], max_size=16*1024*1024, origin='http://localhost:9271') as ws:
            async def call(method, params=None):
                nonlocal counter
                counter += 1
                seq = counter
                await ws.send(json.dumps({'id': seq, 'method': method, 'params':params or {}}))
                while True:
                    data=json.loads(await ws.recv())
                    if data.get('method')=='Runtime.exceptionThrown':errors.append(data['params'])
                    if data.get('id')==seq:
                        if 'error' in data: raise RuntimeError(data['error'])
                        return data.get('result',{})
            async def js(expression):
                res=await call('Runtime.evaluate',{'expression':expression,'returnByValue':True,'awaitPromise':True})
                if 'exceptionDetails' in res:raise RuntimeError(res['exceptionDetails'])
                return res.get('result',{}).get('value')
            await call('Runtime.enable')
            await call('Page.enable')
            for _ in range(90):
                status=await js("typeof loaded!=='undefined' ? {loaded,busy,lastError} : null")
                if status and (status['loaded'] or not status['busy']):break
                await asyncio.sleep(.5)
            print('SYNC',json.dumps(status),flush=True)
            assert status and status['loaded'],status
            report_summary=await js((ROOT/'tests/report-summary.js').read_text(encoding='utf-8'))
            print('REPORT_SUMMARY',json.dumps(report_summary),flush=True)
            assert all(c['ok'] for c in report_summary['checks'])
            integrity=await js((ROOT/'tests/metric-integrity.js').read_text(encoding='utf-8'))
            print('METRIC_INTEGRITY',json.dumps(integrity),flush=True)
            assert all(c['ok'] for c in integrity['checks'])
            print('LIVE',json.dumps(await js("({rows:rows.length,selected:selected.length,creatives:creatives.length,kpis:[...document.querySelectorAll('.kpi .value')].map(e=>e.textContent),rawSample:raw[0]})")),flush=True)
            checks = await js("""(() => {
                const results=[];const check=(name,ok)=>{results.push({name,ok:!!ok});};
                const make=(x={})=>A.resolveTypes(A.normalize([{'Campaign name':'Traffic_WA_Main_ABO','Ad set name':'BHI_T_M_W','Ad name':'1/10/26 - V_TEST','Ad Trim':'V_TEST','Reporting starts':'2026-10-01','Amount spent (IDR)':100000,'Result type':'Messaging conversations started','Results':10,'Leads':5,'Booking':2,'Impressions':1000,'Link clicks':20,'Views':1200,'3-second video plays':300,'Video plays at 100%':120,'Frequency':'1,20',...x}]))[0];
                const a=make(),b=make({'Amount spent (IDR)':900000,'Results':10,'Impressions':9000,'Link clicks':90,'Views':9000,'Video plays at 100%':90,'3-second video plays':900});
                const s=A.aggregate([a,b]);check('Weighted CPR = total spend / results',s.cpr===50000);check('Weighted CTR',Math.abs(s.ctr-1.1)<1e-10);check('Views rate uses views denominator',Math.abs(s.view-210/10200*100)<1e-10);check('Hook uses video impressions',s.hook===12);
                check('No-results CPR is null',A.aggregate([make({'Results':0})]).cpr===null);
                check('Zero result after threshold alerts',A.state({...A.aggregate([make({'Results':0})]),items:[make({'Results':0})]},config)==='CRITICAL');
                check('Small sample not winner',A.state(A.aggregate([make({'Amount spent (IDR)':1000,'Results':1})]),config)==='SAMPLE');
                check('Above-target watch is an alert',A.state(A.aggregate([make({'Amount spent (IDR)':100000,'Results':3})]),config)==='CRITICAL');
                check('BDS is separate from BSD',make({'Ad set name':'BSD_T_M_W'}).center==='BSD'&&!A.MINE.includes('BSD'));
                check('SLSA campaign detected',make({'Campaign name':'SLSA_Traffic'}).brand==='SLSA');
                check('SLSA prefix preserves center',make({'Ad set name':'SLSA_BHI_T_M_W'}).center==='BHI'&&make({'Ad set name':'SLSA_BHI_T_M_W'}).objective==='Traffic');
                check('Mixed Results cannot be pooled',A.aggregate([a,make({'Result type':'Booking'})]).cpr===null);
                check('Image hook excluded',A.aggregate([make({'Ad Trim':'I_TEST'})]).hook===null);
                check('Missing key message remains blank',a.message==='');
                check('Missing leads differs from zero',make({'Leads':null}).leads===null&&make({'Leads':'0'}).leads===0);
                check('Incomplete leads do not produce misleading CPL',A.aggregate([a,make({'Leads':null})]).cpl===null);
                check('Mixed brands cannot be pooled',A.aggregate([a,make({'Campaign name':'SLSA_Traffic'})]).cpr===null);
                check('US date parse from locale',A.date('10/30/2026')==='2026-10-30');
                check('GViz date parse',A.date('Date(2026,9,30)')==='2026-10-30');
                check('Local decimal parse',A.num('1,16')===1.16&&A.num('Rp48,957')===48957);
                check('No BSD leakage in managed view',selected.every(r=>A.MINE.includes(r.center)));
                return results;
            })()""")
            print('ANALYTICS',json.dumps(checks),flush=True)
            assert all(c['ok'] for c in checks)
            partial=await js((ROOT/'tests/partial-metrics.js').read_text(encoding='utf-8-sig'))
            print('PARTIAL',json.dumps(partial),flush=True)
            assert all(c['ok'] for c in partial['checks'])
            adset_checks=await js((ROOT/'tests/adsets.js').read_text(encoding='utf-8'))
            print('ADSETS',json.dumps(adset_checks),flush=True)
            assert all(c['ok'] for c in adset_checks)
            conversion_checks=await js((ROOT/'tests/booking-conversion.js').read_text(encoding='utf-8'))
            print('BOOKING_CONVERSION',json.dumps(conversion_checks),flush=True)
            assert all(c['ok'] for c in conversion_checks)
            iteration_checks=await js((ROOT/'tests/iteration.js').read_text(encoding='utf-8'))
            print('ITERATION',json.dumps(iteration_checks),flush=True)
            assert all(c['ok'] for c in iteration_checks)
            meeting_checks=await js((ROOT/'tests/meeting.js').read_text(encoding='utf-8'))
            print('MEETING',json.dumps(meeting_checks),flush=True)
            assert all(c['ok'] for c in meeting_checks)
            saved_bucket_count=await js("MeetingStore.read().items.length")
            await call('Page.reload',{'ignoreCache':True})
            for _ in range(90):
                status=await js("typeof loaded!=='undefined' ? {loaded,busy,lastError} : null")
                if status and status['loaded']:break
                await asyncio.sleep(.5)
            assert status and status['loaded'],'Reload failed'
            assert await js("MeetingStore.read().items.length")==saved_bucket_count,'Bucket did not survive page reload'
            rule_checks=await js((ROOT/'tests/rules.js').read_text(encoding='utf-8'))
            print('RULES',json.dumps(rule_checks),flush=True)
            assert all(c['ok'] for c in rule_checks)
            period_checks=await js((ROOT/'tests/period-learning.js').read_text(encoding='utf-8'))
            print('PERIOD_LEARNING',json.dumps(period_checks),flush=True)
            assert all(c['ok'] for c in period_checks)
            time_checks=await js((ROOT/'tests/time_views.js').read_text(encoding='utf-8'))
            print('TIME_VIEWS',json.dumps(time_checks),flush=True)
            assert all(c['ok'] for c in time_checks)
            comparison_checks=await js((ROOT/'tests/comparison.js').read_text(encoding='utf-8'))
            print('COMPARISON',json.dumps(comparison_checks),flush=True)
            account_checks=await js((ROOT/'tests/accounts.js').read_text(encoding='utf-8-sig'))
            print('ACCOUNTS',json.dumps(account_checks),flush=True)
            assert all(c['ok'] for c in account_checks)
            scope_checks=await js((ROOT/'tests/work-scope.js').read_text(encoding='utf-8'))
            print('WORK_SCOPE',json.dumps(scope_checks),flush=True)
            assert all(c['ok'] for c in scope_checks)
            assert all(c['ok'] for c in comparison_checks)
            await call('Emulation.setDeviceMetricsOverride',{'width':1512,'height':1100,'deviceScaleFactor':1,'mobile':False})
            await js("document.fonts.ready")
            await asyncio.sleep(1)
            screenshot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'dashboard-desktop.png').write_bytes(base64.b64decode(screenshot['data']))
            await js("document.querySelector('.trend-grid').previousElementSibling.scrollIntoView({block:'start'})")
            await asyncio.sleep(.3)
            screenshot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'time-charts-desktop.png').write_bytes(base64.b64decode(screenshot['data']))
            await js("document.querySelector('.period-values').open=true;document.querySelector('.period-values').scrollIntoView({block:'start'})")
            await asyncio.sleep(.3)
            screenshot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'period-learning-desktop.png').write_bytes(base64.b64decode(screenshot['data']))
            await js("explorerGrain='weekly';explorerLayout='compare';navigate('creatives')")
            await asyncio.sleep(.6)
            await js("window.scrollTo({top:document.querySelector('.comparison-intro').getBoundingClientRect().top+window.scrollY-20,behavior:'instant'})")
            await asyncio.sleep(.3)
            screenshot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'comparison-weekly.png').write_bytes(base64.b64decode(screenshot['data']))
            await js("explorerGrain='summary';navigate('overview')")
            view_checks=[]
            for v in ['meeting','centers','messages','creatives','alerts','data','overview']:
                r=await js(f"navigate('{v}'); ({{view,body:document.getElementById('viewContent').innerText.length,overflow:document.documentElement.scrollWidth>innerWidth}})")
                view_checks.append(r)
                assert r['body']>100 and not r['overflow'],r
            await js("meetingTab='briefing';navigate('meeting');document.querySelector('.meeting-hero').scrollIntoView({block:'start'})")
            screenshot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'meeting-desktop.png').write_bytes(base64.b64decode(screenshot['data']))
            await js("meetingTab='bucket';render();document.querySelector('.meeting-board').scrollIntoView({block:'start'})")
            screenshot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'meeting-bucket.png').write_bytes(base64.b64decode(screenshot['data']))
            await js("navigate('creatives');showDetail(creatives.find(g=>g.spend>0).id)")
            assert await js("document.getElementById('detailDialog').open")
            await js("document.getElementById('detailDialog').close();document.getElementById('centerFilter').value='BDS';render()")
            assert await js("selected.length===0")
            await js("reset();document.getElementById('brandFilter').value='SLSA';render()")
            assert await js("selected.length===0")
            await js("reset();navigate('alerts');alertMode='missing';render()")
            assert await js("explorerList(true).every(g=>g.missing)")
            assert await js("document.getElementById('messageFilter').value='MISSING';updateOptions();document.getElementById('messageFilter').value==='MISSING'")
            await js("reset();showDetail(creatives.find(g=>g.items.some(r=>r.raw._format?.['Spend Share'])).id)")
            assert await js("""(() => {const g=creatives.find(g=>g.items.some(r=>r.raw._format?.['Spend Share']));const first=[...g.items].sort((a,b)=>a.day.localeCompare(b.day))[0];return document.querySelector('#detailContent > .table-wrap tbody tr:first-child td:last-child').textContent===first.raw._format['Spend Share'];})()"""),'Original share formatting mismatch'
            await js("document.getElementById('detailDialog').close()")
            # Exercise future key-message UI using an in-memory fixture only.
            assert await js("""(() => {
                const saved=rows;
                try {
                    rows=rows.map((r,i)=>({...r,message:i%2?'Test message A':'Test message B'}));
                    updateOptions();navigate('messages');
                    return document.querySelectorAll('.matrix tbody tr').length===2 && document.getElementById('viewContent').innerText.includes('Key message performance by center');
                } finally {rows=saved;updateOptions();navigate('overview');}
            })()"""),'Key message matrix fixture failed'
            # Failed refresh must retain previous data and clearly mark stale state.
            assert await js("""(async () => {
                const original=jsonp,n=rows.length;jsonp=()=>Promise.reject(new Error('QA simulated connection failure'));
                try {await sync();return rows.length===n && !!lastError && document.getElementById('syncStatus').innerText.includes('Sync gagal');}
                finally {jsonp=original;lastError='';render();}
            })()"""),'Stale-data handling failed'
            assert await js("""(async () => {
                const original=jsonp,savedRaw=raw,savedKnowledge=knowledge;
                const last=[...rows].sort((a,b)=>b.day.localeCompare(a.day))[0];
                const d=new Date(last.day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);const next=d.toISOString().slice(0,10);
                jsonp=tab=>Promise.resolve(tab==='Raw Data'?[...savedRaw,{...last.raw,'Reporting starts':next}]:savedKnowledge);
                try {
                    rollingPeriod=true;await sync();const moved=document.getElementById('endFilter').value===next;
                    rollingPeriod=false;document.getElementById('endFilter').value=last.day;await sync();
                    return moved&&document.getElementById('endFilter').value===last.day;
                } finally {jsonp=original;rollingPeriod=true;}
            })()"""),'Rolling/default and custom periods not preserved'
            await js("reset();navigate('overview')")
            await js("sync()")
            await call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
            await asyncio.sleep(.5)
            assert not await js("document.documentElement.scrollWidth>innerWidth"),'Mobile overflow'
            await js("navigate('creatives');document.querySelector('[data-grain-kind=explorer][data-grain=weekly]').click()")
            assert not await js("document.documentElement.scrollWidth>innerWidth"),'Mobile weekly explorer overflow'
            for meeting_tab in ['briefing','iterate','learning','bucket']:
                await js(f"meetingTab='{meeting_tab}';navigate('meeting')")
                assert not await js("document.documentElement.scrollWidth>innerWidth"),'Mobile meeting overflow: '+meeting_tab
            await js("explorerGrain='summary';reset();navigate('overview')")
            screenshot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'dashboard-mobile.png').write_bytes(base64.b64decode(screenshot['data']))
            print('VIEWS',json.dumps(view_checks),flush=True)
            # Verify the delivered single file works when opened without a server.
            await call('Page.navigate',{'url':(ROOT/'Dashboard_ads.html').as_uri()})
            for _ in range(80):
                status=await js("typeof loaded!=='undefined' ? {loaded,busy,lastError} : null")
                if status and status['loaded']:break
                await asyncio.sleep(.5)
            assert status and status['loaded'],'Standalone file could not load Google Sheet'
            print('STANDALONE',json.dumps(status),flush=True)
            print('ERRORS',json.dumps(errors),flush=True)
            assert not errors
            (WORK/'qa-results.json').write_text(json.dumps({'analytics':checks,'time_views':time_checks,'views':view_checks,'errors':errors},indent=2),encoding='utf-8')
            await call('Browser.close')
    finally:
        for proc in [browser,server]:
            if proc.poll() is None: proc.terminate()

if __name__=='__main__':asyncio.run(run())
