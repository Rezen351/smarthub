#!/usr/bin/env python3
"""Exercise the built Reception UI with Firefox and an isolated mock API."""

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import tempfile
import threading
import time
from urllib.request import Request, urlopen


dist = Path(__file__).resolve().parents[1] / 'dist'
state = {'save_fails': True, 'print_fails': True, 'creates': 0, 'prints': [],
         'weight': 12, 'online': True, 'stable': True, 'healthy': True}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(dist), **kwargs)

    def log_message(self, *_):
        pass

    def reply(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        if self.path == '/api/v1/health':
            return self.reply({'status': 'ok' if state['healthy'] else 'degraded',
                               'database': 'connected' if state['healthy'] else 'error'})
        if self.path.startswith('/api/'):
            data = []
            if self.path.endswith('/farmers'):
                data = [{'id': 'farmer', 'code': 'FMR-001', 'name': 'Test Farmer'}]
            elif self.path.endswith('/weight'):
                data = {'online': state['online'], 'weightKg': state['weight'],
                        'isStable': state['stable'], 'capacityKg': 150}
            return self.reply({'success': True, 'data': data})
        if not (dist / self.path.lstrip('/')).is_file():
            self.path = '/index.html'
        super().do_GET()

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or '{}')
        if self.path.endswith('/weighing'):
            state['creates'] += 1
            if state['save_fails']:
                return self.reply({'error': {'message': 'Save unavailable'}}, 500)
            return self.reply({'success': True, 'data': {'id': 'saved-1', 'code': 'WRG-SERVER-1'}})
        if self.path.endswith('/print'):
            state['prints'].append(body)
            if state['print_fails']:
                return self.reply({'error': {'message': 'Printer unavailable'}}, 500)
        self.reply({'success': True, 'data': {'online': True}})


def request(path, data=None, method=None):
    encoded = None if data is None else json.dumps(data).encode()
    req = Request('http://localhost:4444' + path, data=encoded,
                  headers={'Content-Type': 'application/json'}, method=method)
    with urlopen(req, timeout=30) as response:
        return json.load(response)['value']


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
session = None
with tempfile.TemporaryFile() as driver_log:
    driver = subprocess.Popen(['geckodriver', '--port', '4444'], stdout=driver_log, stderr=driver_log)
    try:
        for _ in range(100):
            try:
                request('/status')
                break
            except OSError:
                time.sleep(0.1)
        session = request('/session', {'capabilities': {'alwaysMatch': {
            'browserName': 'firefox', 'pageLoadStrategy': 'eager',
            'moz:firefoxOptions': {'args': ['-headless']},
        }}})['sessionId']
        base = '/session/' + session

        def js(script):
            return request(base + '/execute/sync', {'script': script, 'args': []})

        def wait(script):
            for _ in range(100):
                if js(script):
                    return
                time.sleep(0.1)
            raise AssertionError('Timed out: ' + script)

        def click(label):
            js('const b = [...document.querySelectorAll("button")].find(b => '
               'b.textContent.trim() === ' + json.dumps(label) + ' && b.getClientRects().length);'
               'if (!b || b.disabled) throw Error("Button unavailable"); b.click();')

        request(base + '/url', {'url': f'http://127.0.0.1:{server.server_port}/login'})
        js('localStorage.setItem("user", JSON.stringify({id:"operator", name:"Operator", role:"OPERATOR"}));')
        request(base + '/url', {'url': f'http://127.0.0.1:{server.server_port}/dashboard/weighing'})
        wait('return !!document.querySelector(".station-page")')
        time.sleep(1)
        js('const i = document.querySelector("input[placeholder*=barcode]"); '
           'Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(i,"FMR-001");'
           'i.dispatchEvent(new Event("input",{bubbles:true}));')
        click('Verify')
        wait('return document.body.innerText.includes("Capture Weight")')
        wait('return [...document.querySelectorAll("button")].some(b => b.textContent.trim()==="Capture Weight" && !b.disabled)')
        assert js('return document.getElementById("focus-weighing-weight").value') == ''
        click('Capture Weight')
        wait('return Number(document.getElementById("focus-weighing-weight").value) === 12')
        state['weight'] = 13
        wait('return document.querySelector(".scale-value").textContent.includes("13")')
        assert js('return Number(document.getElementById("focus-weighing-weight").value)') == 12
        state['stable'] = False
        wait('return document.body.innerText.includes("Reading settling")')
        assert js('return [...document.querySelectorAll("button")].find(b => b.textContent.trim()==="Capture Weight").disabled')
        state['online'] = False
        wait('return document.body.innerText.includes("Waiting for scale")')
        assert js('return [...document.querySelectorAll("button")].find(b => b.textContent.trim()==="Capture Weight").disabled')
        state['healthy'] = False
        js('window.dispatchEvent(new Event("online"))')
        wait('return document.body.textContent.includes("SERVER OFFLINE")')
        state['healthy'] = True
        js('window.dispatchEvent(new Event("online"))')
        wait('return document.body.textContent.includes("SERVER ONLINE")')
        click('Review Weight')
        wait('return document.body.innerText.includes("Approve & Print")')
        click('Approve & Print')
        wait('return document.body.innerText.includes("Retry Save & Print")')
        assert state['prints'] == [], 'Failed save must never print'
        state['save_fails'] = False
        click('Retry Save & Print')
        wait('return document.body.innerText.includes("Print failed. Intake is saved.")')
        assert state['creates'] == 2, state
        assert all(j['code'] == 'WRG-SERVER-1' for j in state['prints'][0]['jobs'])
        state['print_fails'] = False
        click('Retry Print')
        wait('return document.body.innerText.includes("Receipt and label sent to printer")')
        assert state['creates'] == 2, 'Print retry must not save another intake'
        for width in (360, 768, 1440):
            request(base + '/window/rect', {'width': width, 'height': 900})
            assert js('return document.documentElement.scrollWidth <= innerWidth'), f'Overflow at {width}'
            assert js('return getComputedStyle(document.querySelector(".station-page > :first-child")).display !== "none"')
        print('Reception capture, save failure/retry, print failure/retry, server codes, and responsive layouts verified.')
    finally:
        if session:
            request('/session/' + session, method='DELETE')
        driver.terminate()
        driver.wait(timeout=10)
        server.shutdown()
