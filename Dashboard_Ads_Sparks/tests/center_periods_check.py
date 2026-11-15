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
    server = subprocess.Popen(['python', '-m', 'http.server', '8851', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    browser = subprocess.Popen([str(CHROME), '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9351', '--remote-allow-origins=http://localhost:9351', '--user-data-dir='+str(WORK/'chrome-center-periods-qa'), '--window-size=1512,1100', 'http://127.0.0.1:8851/Dashboard_ads.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    counter = 0
    errors = []
    try:
        targets = []
        for _ in range(50):
            try:
                targets = json.load(urllib.request.urlopen('http://127.0.0.1:9351/json', timeout=1))
                if any(t['type']=='page' for t in targets): break
            except Exception: pass
            await asyncio.sleep(.2)
        target = next(t for t in targets if t['type']=='page')
        async with websockets.connect(target['webSocketDebuggerUrl'], max_size=16*1024*1024, origin='http://localhost:9351') as ws:
            async def call(method, params=None):
                nonlocal counter
                counter += 1
                seq = counter
                await ws.send(json.dumps({'id': seq, 'method': method, 'params':params or {}}))
                while True:
                    data=json.loads(await asyncio.wait_for(ws.recv(),60))
                    if data.get('method')=='Runtime.exceptionThrown':errors.append(data['params'])
                    if data.get('method')=='Runtime.consoleAPICalled' and data['params'].get('type')=='debug':
                        print('CHECK', ' '.join(str(a.get('value','')) for a in data['params'].get('args',[])),flush=True)
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
            await call('Page.navigate',{'url':'http://127.0.0.1:8851/Dashboard_ads.html?audit='+str(time.time_ns())})
            await asyncio.sleep(1)
            for _ in range(90):
                status=await js("typeof loaded!=='undefined' ? {loaded,busy,lastError} : null")
                if status and (status['loaded'] or not status['busy']):break
                await asyncio.sleep(.5)
            print('SYNC',json.dumps(status),flush=True)
            print('BUILD',await js('typeof A.adIdentity'),flush=True)
            
            assert status and status['loaded'],status
            for name in filter(None,os.environ.get('CENTER_PERIOD_TESTS','center-periods,metric-scorecards').split(',')):
                result=await js((ROOT/('tests/'+name+'.js')).read_text(encoding='utf-8'))
                print(name,json.dumps({'passed':result['passed']}),flush=True)
            await call('Emulation.setDeviceMetricsOverride',{'width':1900,'height':1200,'deviceScaleFactor':1,'mobile':False})
            await js("$('startFilter').value='2026-10-19';$('endFilter').value='2026-11-12';navigate('centers');$('centerPeriodsSlot').scrollIntoView()")
            print('LIVE',json.dumps(await js((ROOT/'tests/center-periods-ui.js').read_text(encoding='utf-8'))),flush=True)
            await js("centerPeriodGrain='weekly';centerPeriodPair='leads';centerPeriodSort='center';centerPeriodOffset=0;refreshCenterPeriods();$('centerPeriodsSlot').scrollIntoView()")
            await asyncio.sleep(.3)
            assert await js("document.querySelector('.cp-window').textContent.includes('9 Nov') && document.querySelector('.cp-window').textContent.includes('2 Nov')")
            shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'center-periods-desktop.png').write_bytes(base64.b64decode(shot['data']))
            await call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':950,'deviceScaleFactor':1,'mobile':False})
            await js("$('centerPeriodsSlot').scrollIntoView()")
            shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'center-periods-laptop.png').write_bytes(base64.b64decode(shot['data']))
            assert await js("getComputedStyle(document.querySelector('.cp-grid')).gridTemplateColumns.trim().split(/\\s+/).length===2")
            assert await js("document.documentElement.scrollWidth <= innerWidth + 1")
            await call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
            await js("$('centerPeriodsSlot').scrollIntoView()")
            mobile=await js("({w:innerWidth,doc:document.documentElement.scrollWidth,table:document.querySelector('.cp-scroll').scrollWidth})")
            assert mobile['doc']<=mobile['w']+1,mobile
            shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'center-periods-mobile.png').write_bytes(base64.b64decode(shot['data']))
            print('MOBILE',json.dumps(mobile),flush=True)
            print('ERRORS',errors,flush=True)
            assert not errors
            (WORK/'center-periods-qa-result.json').write_text(json.dumps({'mobile':mobile,'runtimeErrors':errors,'completed':True}),encoding='utf-8')
            await call('Browser.close')
    finally:
        for proc in [browser,server]:
            if proc.poll() is None:proc.terminate()
if __name__=='__main__':asyncio.run(run())
