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
    server = subprocess.Popen(['python', '-m', 'http.server', '8813', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    browser = subprocess.Popen([str(CHROME), '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9273', '--remote-allow-origins=http://localhost:9273', '--user-data-dir='+str(WORK/'chrome-summary-focused'), '--window-size=1512,1100', 'http://127.0.0.1:8813/Dashboard_ads.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    counter = 0
    errors = []
    try:
        targets = []
        for _ in range(50):
            try:
                targets = json.load(urllib.request.urlopen('http://127.0.0.1:9273/json', timeout=1))
                if any(t['type']=='page' for t in targets): break
            except Exception: pass
            await asyncio.sleep(.2)
        target = next(t for t in targets if t['type']=='page')
        async with websockets.connect(target['webSocketDebuggerUrl'], max_size=16*1024*1024, origin='http://localhost:9273') as ws:
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
            importer=(ROOT/'import-workflow/SparksImport.gs').read_text(encoding='utf-8')
            fixture="""
const checks=[],check=(name,ok)=>checks.push({name,ok:!!ok});
const Utilities={base64Encode:x=>String(x),computeDigest:(a,b)=>b,DigestAlgorithm:{SHA_256:'test'}};
const headers=['Campaign name','Ad set name','Ad name','Day','Amount spent (IDR)','Results','Reporting starts','Reporting ends'];
const data=[headers,['Traffic','BHI_SET','1/11/26 - TEST','2026-11-01',100000,5,'2026-11-01','2026-11-01']];
const plans=['SE Main','SE Secondary','SE Third'].map(source=>prepare(source,data,'upsert','',''));
check('Third import tab registered',SOURCES['SE Third']==='Import SE Third');
check('Identical names and date across three import sources remain separate',new Set(plans.map(p=>identity(p.rows[0]))).size===3);
check('Third import preserves spend and Results',plans[2].rows[0].Results===5&&plans[2].rows[0]['Amount spent (IDR)']===100000);
check('Third importer assigns Third account',buildImportOutput.toString().includes("p.source==='SE Third'?'Third'"));
let rejected=false;try{prepare('SLSA',data,'upsert','','')}catch(e){rejected=true}check('English cannot enter SLSA source',rejected);
return checks;
"""
            import_result=await js('new Function('+json.dumps(importer+'\n'+fixture)+')()')
            print('third-import',json.dumps(import_result),flush=True)
            assert all(c['ok'] for c in import_result)
            for name in ['accounts','report-summary','adsets','metric-integrity']:
                result=await js((ROOT/('tests/'+name+'.js')).read_text(encoding='utf-8'))
                print(name,json.dumps(result),flush=True)
                checks=result['checks'] if isinstance(result,dict) else result
                assert all(c['ok'] for c in checks)
            await js("$('objectiveFilter').value='ALL';navigate('overview')")
            for width in [1512,390]:
                await call('Emulation.setDeviceMetricsOverride',{'width':width,'height':1100,'deviceScaleFactor':1,'mobile':width<500})
                await js("document.querySelector('.kpis').scrollIntoView({block:'start'})")
                shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
                (WORK/f'summary-matched-{width}.png').write_bytes(base64.b64decode(shot['data']))
                assert await js('document.documentElement.scrollWidth<=innerWidth')
            print('ERRORS',errors,flush=True)
            assert not errors
            await call('Browser.close')
    finally:
        for proc in [browser,server]:
            if proc.poll() is None:proc.terminate()
if __name__=='__main__':asyncio.run(run())
