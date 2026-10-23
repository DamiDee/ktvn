#!/usr/bin/env python3
"""Connect the existing K-Rides build to loopback OSRM; rollback on failure."""
from pathlib import Path
import datetime
import json
import os
import re
import shutil
import subprocess
import time
import urllib.request

root = Path('/root/ktvn')
env_file = root / '.env.production.local'
launcher = Path('/root/.nvm/versions/node/v24.13.0/bin/pm2')
node = launcher.parent / 'node'
command_env = dict(os.environ, PATH=str(launcher.parent) + ':' + os.environ.get('PATH', ''))

def pm2(*args):
    return subprocess.run([str(node), str(launcher), *args], env=command_env, capture_output=True, text=True, check=True)

apps = json.loads(pm2('jlist').stdout)
app = next((app for app in apps if app.get('name') == 'ktvn' and app.get('pm2_env', {}).get('pm_cwd') == str(root)), None)
if not app or app.get('pm2_env', {}).get('status') != 'online':
    raise SystemExit('The expected online K-Rides process was not found.')
app_id = str(app['pm_id'])
if app.get('pm2_env', {}).get('ROUTING_API_BASE_URL'):
    raise SystemExit('PM2 already defines a routing URL; inspect precedence before changing it.')
backup = Path('/opt/krides-osrm/backups') / ('app-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(parents=True, mode=0o700)
existed = env_file.exists()
original = env_file.read_text() if existed else ''
if existed:
    shutil.copy2(env_file, backup / 'env.production.local')
lines = [line for line in original.splitlines() if not re.match(r'^\s*(?:export\s+)?ROUTING_API_BASE_URL\s*=', line)]
lines.append('ROUTING_API_BASE_URL=http://127.0.0.1:5001')
route = 'http://127.0.0.1:4000/api/rides/geo/route?points=%5B%7B%22lat%22%3A9.0721%2C%22lng%22%3A7.4246%7D%2C%7B%22lat%22%3A9.0647%2C%22lng%22%3A7.4728%7D%5D'
try:
    env_file.write_text('\n'.join(lines) + '\n')
    env_file.chmod(0o600)
    pm2('restart', app_id)
    for attempt in range(20):
        try:
            with urllib.request.urlopen(route, timeout=5) as response:
                data = json.load(response)
            if len(data.get('points', [])) >= 2 and data.get('distanceMeters', 0) > 0:
                break
        except Exception:
            pass
        time.sleep(2)
    else:
        raise RuntimeError('The existing app did not return a valid routed response.')
    print(json.dumps({'app': 'ktvn', 'routing': 'http://127.0.0.1:5001', 'points': len(data['points']), 'distanceMeters': data['distanceMeters'], 'durationSeconds': data['durationSeconds'], 'backup': str(backup)}))
except BaseException:
    if existed:
        shutil.copy2(backup / 'env.production.local', env_file)
    else:
        env_file.unlink(missing_ok=True)
    pm2('restart', app_id)
    raise
