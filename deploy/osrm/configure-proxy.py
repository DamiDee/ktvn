#!/usr/bin/env python3
"""Add the bounded HTTPS routing path to the existing K-Rides nginx site."""
from pathlib import Path
import datetime
import shutil
import subprocess

site = Path('/etc/nginx/sites-available/k-ride')
limits = Path('/etc/nginx/conf.d/krides-osrm.conf')
backup = Path('/opt/krides-osrm/backups') / datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
marker = '    server_name app.freebus.cloud;'
location = '''
    # K-Rides OSRM: raw service stays on loopback; expose driving routes only.
    location ^~ /routing/route/v1/driving/ {
        limit_req zone=krides_osrm_ip burst=20 nodelay;
        limit_req_status 429;
        access_log off;
        limit_except GET { deny all; }
        proxy_pass http://127.0.0.1:5001/route/v1/driving/;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1;
        proxy_set_header Connection "";
        proxy_connect_timeout 2s;
        proxy_read_timeout 10s;
        proxy_send_timeout 10s;
        add_header Cache-Control "public, max-age=60" always;
    }
    location ^~ /routing/ {
        return 404;
    }
'''
limit_config = 'limit_req_zone $binary_remote_addr zone=krides_osrm_ip:10m rate=5r/s;\n'
original = site.read_text()
if 'location ^~ /routing/route/v1/driving/' in original:
    raise SystemExit('Routing location already exists; verify rather than rewriting.')
if marker not in original or 'listen 443 ssl' not in original:
    raise SystemExit('Unexpected nginx site; review first.')
if limits.exists():
    raise SystemExit('OSRM limit config already exists; review first.')
backup.mkdir(parents=True, exist_ok=False)
shutil.copy2(site, backup / 'k-ride.conf')
try:
    site.write_text(original.replace(marker, marker + '\n' + location, 1))
    limits.write_text(limit_config)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except BaseException:
    shutil.copy2(backup / 'k-ride.conf', site)
    limits.unlink(missing_ok=True)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
print('Enabled HTTPS driving-route proxy. Backup:', backup)
