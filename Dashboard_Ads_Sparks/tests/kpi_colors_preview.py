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
            reading=await js("(()=>{navigate('overview');document.querySelector('.kpis').scrollIntoView();return [...document.querySelectorAll('.kpi[data-kpi]')].map(e=>({metric:e.dataset.kpi,bg:getComputedStyle(e).backgroundColor,tone:e.className}));})()")
            assert len(reading)==9,reading
            cases=await js("(()=>{const s={rows:1,cpr:20000,cpl:30000,cpb:250000,leadRate:85};return [kpiPerformance(s,'cpr'),kpiPerformance(s,'cpl'),kpiPerformance(s,'cpb'),kpiPerformance(s,'leadRate'),kpiPerformance(s,'spend'),CostTargets.limit('cpb',config),kpiPerformance({...s,cpb:null},'cpb')];})()")
            assert cases==['good','good','bad','good','neutral',200000,'neutral'],cases
            print('TARGET CHECKS',cases,flush=True)
            print('KPI COLORS',reading,flush=True)
            shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'kpi-colors.png').write_bytes(base64.b64decode(shot['data']))
            print('ERRORS',errors,flush=True)
            assert not errors
            await call('Browser.close')
    finally:
        for proc in [browser,server]:
            if proc.poll() is None:proc.terminate()
if __name__=='__main__':asyncio.run(run())
