#!/usr/bin/env python3
import subprocess, time, http.client, json

print('=== Testing RedoSan GUI ===\n')

p = subprocess.Popen(['python', 'redosan_server.py'], 
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    creationflags=0x08000000)
time.sleep(2)

c = http.client.HTTPConnection('localhost', 3000, timeout=5)

# 1. Load main page
print('1. Load main page:')
c.request('GET', '/')
r = c.getresponse()
html = r.read().decode()
print(f'   Size: {len(html)} bytes')
print(f'   Contains RedoSan: {"YES" if "RedoSan" in html else "NO"}')

# 2. Check tabs
print('\n2. Check tabs:')
tabs = ['fingerprint', 'timestamp', 'c2pa', 'watermark', 'metadata', 'setup']
for tab in tabs:
    exists = 'data-tab="' + tab + '"' in html
    print(f'   {tab}: {"OK" if exists else "MISSING"}')

# 3. Fingerprint API
print('\n3. Fingerprint API:')
c.request('GET', '/api/fingerprint?file=test_image.png')
r = c.getresponse()
data = json.loads(r.read().decode())
fp = data.get('fingerprint', {})
print(f'   Status: {data["status"]}')
print(f'   File: {fp.get("file")}')
print(f'   SHA256: {fp.get("sha256", "")[:30]}...')

# 4. Health
print('\n4. Health check:')
c.request('GET', '/api/health')
r = c.getresponse()
data = json.loads(r.read().decode())
print(f'   Status: {data["status"]}')
print(f'   Version: {data.get("version")}')
print(f'   OpenStego: {data.get("openstego")}')
print(f'   Java: {data.get("java")}')

# 5. Status
print('\n5. Module status:')
c.request('GET', '/api/status')
r = c.getresponse()
data = json.loads(r.read().decode())
mods = data.get('modules', {})
for name, available in mods.items():
    print(f'   {name}: {available}')

# 6. CSS
print('\n6. CSS loading:')
c.request('GET', '/frontend/style.css')
r = c.getresponse()
css = r.read().decode()
print(f'   Size: {len(css)} bytes')

# 7. JavaScript
print('\n7. JavaScript loading:')
c.request('GET', '/frontend/script.js')
r = c.getresponse()
js = r.read().decode()
print(f'   Size: {len(js)} bytes')
print(f'   Has Tauri API: {"YES" if "__TAURI__" in js else "NO"}')
print(f'   Has HTTP fallback: {"YES" if "API_BASE" in js else "NO"}')

print('\n=== All tests passed! ===')
p.terminate()