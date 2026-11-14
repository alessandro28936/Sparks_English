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
            audit=await js(r"""(()=>{const output=[];for(const [start,end] of [['2026-11-01','2026-11-10'],['2026-11-01','2026-11-11'],['2026-11-05','2026-11-11']]){$('startFilter').value=start;$('endFilter').value=end;$('accountFilter').value='ALL';$('centerFilter').value='ALL';$('objectiveFilter').value='WHATSAPP';updateOptions();refreshData();output.push({start,end,centers:centersInScope().map(c=>{const items=selected.filter(r=>r.center===c),plain=A.aggregate(items),recovered=summaryAggregate(items);return {center:c,results:plain.results,leads:plain.leads,booking:plain.booking,rows:plain.rows,leadRows:plain.leadRows,bookingRows:plain.bookingRows,recoveredLeads:recovered.leads,recoveredBooking:recovered.booking,afterLeadsRows:recovered.leadRows,afterBookingRows:recovered.bookingRows,observed:recovered.observed,missing:A.group(items.filter(r=>r.leads===null||r.booking===null),r=>r.ad+' | '+r.adset).map(g=>({ad:g.key,days:[...g.days],spend:g.spend,results:g.results,issues:g.reportIssues})).slice(0,12)};})});}return output;})()""")
            (WORK/'audit/center-cards-before.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
            print(json.dumps(audit),flush=True)
            await call('Browser.close')
    finally:
        for proc in [browser,server]:
            if proc.poll() is None:proc.terminate()
if __name__=='__main__':asyncio.run(run())
