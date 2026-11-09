# roda JS dentro do WebView do app (emulador) via DevTools
import json, sys, time, urllib.request, websocket
tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9222/json'))
ws = websocket.create_connection(tabs[0]['webSocketDebuggerUrl'], timeout=60, suppress_origin=True)
n = 0
def ev(expr):
    global n; n += 1
    ws.send(json.dumps({'id': n, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'awaitPromise': True, 'returnByValue': True}}))
    while True:
        r = json.loads(ws.recv())
        if r.get('id') == n: return r.get('result', {}).get('result', {}).get('value', r)
print(ev(sys.argv[1]))
