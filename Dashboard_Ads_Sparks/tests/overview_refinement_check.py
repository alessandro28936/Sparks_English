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
    server = subprocess.Popen(['python', '-m', 'http.server', '8847', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    browser = subprocess.Popen([str(CHROME), '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9347', '--remote-allow-origins=http://localhost:9347', '--user-data-dir='+str(WORK/'chrome-audit-third-fresh'), '--window-size=1512,1100', 'http://127.0.0.1:8847/Dashboard_ads.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    counter = 0
    errors = []
    try:
        targets = []
        for _ in range(50):
            try:
                targets = json.load(urllib.request.urlopen('http://127.0.0.1:9347/json', timeout=1))
                if any(t['type']=='page' for t in targets): break
            except Exception: pass
            await asyncio.sleep(.2)
        target = next(t for t in targets if t['type']=='page')
        async with websockets.connect(target['webSocketDebuggerUrl'], max_size=16*1024*1024, origin='http://localhost:9347') as ws:
            async def call(method, params=None):
                nonlocal counter
                counter += 1
                seq = counter
                await ws.send(json.dumps({'id': seq, 'method': method, 'params':params or {}}))
                while True:
                    data=json.loads(await asyncio.wait_for(ws.recv(),60))
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
            await call('Network.enable')
            await call('Network.setCacheDisabled',{'cacheDisabled':True})
            await call('Page.navigate',{'url':'http://127.0.0.1:8847/Dashboard_ads.html?audit='+str(time.time_ns())})
            await asyncio.sleep(1)
            for _ in range(90):
                status=await js("typeof loaded!=='undefined' ? {loaded,busy,lastError} : null")
                if status and (status['loaded'] or not status['busy']):break
                await asyncio.sleep(.5)
            print('SYNC',json.dumps(status),flush=True)
            print('BUILD',await js('typeof A.adIdentity'),flush=True)
            
            assert status and status['loaded'],status
            for name in ['rules','cost-targets','report-summary','overview-refinement']:
                result=await js((ROOT/('tests/'+name+'.js')).read_text(encoding='utf-8'))
                print(name, json.dumps(result),flush=True)
            result=await js(r"""(()=>{navigate('overview');const make=(spend,leads,booking)=>({day:'2026-11-10',ad:'QA',adset:'QA',campaign:'QA',brand:'English',account:'Main',center:'BHI',objective:'Traffic',resultType:'Messaging conversations started',spend,results:10,leads,booking,impressions:100,clicks:1,views:0});const missing=make(100000,null,null),zero=make(350000,0,0),good=make(100000,10,5);if(priorityIssues(A.aggregate([missing]),[missing],[]).some(x=>/0 Leads|0 Booking/.test(x.text)))throw Error('Missing became zero');if(!priorityIssues(A.aggregate([zero]),[zero],[]).some(x=>x.text.includes('0 Booking')))throw Error('Paid zero booking not flagged');if(priorityIssues(A.aggregate([good]),[good],[]).length)throw Error('Good ad flagged');if(priorityIssues(A.aggregate([{...zero,spend:1}]),[{...zero,spend:1}],[]).length)throw Error('Low spend flagged');if(!document.querySelector('.priority-review'))throw Error('No priority section');document.querySelector('.priority-review').scrollIntoView();return {ads:priorityData.ads.length,sets:priorityData.sets.length,validation:priorityData.validation};})()""")
            print('PRIORITIES',result,flush=True)
            await js("document.querySelector('[data-priority-tab=ads]').click();if(priorityTab!=='ads')throw Error('Tab failed');document.querySelector('[data-priority-tab=sets]').click();if(priorityData.sets.length){document.querySelector('[data-priority-set]').click();if(!$('detailDialog').open)throw Error('No set drilldown');const ad=$('detailContent').querySelector('[data-detail]');if(ad)ad.click();$('detailDialog').close();}document.querySelector('.priority-review').scrollIntoView()")
            shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'priorities.png').write_bytes(base64.b64decode(shot['data']))
            await js("document.querySelector('.period-primary').scrollIntoView()")
            shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'period-refinement.png').write_bytes(base64.b64decode(shot['data']))
            await call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':False})
            bounds=await js("({width:innerWidth,doc:document.documentElement.scrollWidth})")
            assert bounds['doc']<=bounds['width']+1,bounds
            print('ERRORS',errors,flush=True)
            assert not errors
            await call('Browser.close')
    finally:
        for proc in [browser,server]:
            if proc.poll() is None:proc.terminate()
if __name__=='__main__':asyncio.run(run())
