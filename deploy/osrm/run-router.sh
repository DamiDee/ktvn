#!/usr/bin/env bash
set -euo pipefail
base=/opt/krides-osrm
image=$(cat "$base/image-ref")
[[ "$image" =~ ^ghcr.io/project-osrm/osrm-backend@sha256:[0-9a-f]{64}$ ]] || exit 1
data=$(readlink -f "$base/current")
[[ "$data" == "$base"/data/nigeria-* || "$data" == "$base"/data/fct-* ]] || exit 1
[ -f "$data/customize.ok" ] || exit 1
settings=$(python3 - "$data/manifest.json" "$image" <<'PY_CHECK'
import json,sys
with open(sys.argv[1]) as f: metadata=json.load(f)
if metadata.get('image')!=sys.argv[2] or metadata.get('algorithm')!='mld':
    raise SystemExit('The engine and prepared dataset must match.')
region=metadata.get('region')
if region=='NG-FC' and metadata.get('routingBase')=='fct-driving.osrm':
    print('fct-driving.osrm 512m 0.5')
elif region is None:
    print('nigeria-driving.osrm 1536m 0.75')
else:
    raise SystemExit('Unsupported routing dataset.')
PY_CHECK
)
read -r route_base memory cpu <<< "$settings"
exec /usr/bin/podman run --rm --pull=never --name krides-osrm \
  --network=host --read-only --user=65534:65534 \
  --cap-drop=ALL --security-opt=no-new-privileges --pids-limit=128 \
  --cpus="$cpu" --memory="$memory" --memory-swap="$memory" \
  -v "$data:/data:ro" "$image" \
  osrm-routed --algorithm mld --mmap --threads 1 --verbosity WARNING \
  --ip 127.0.0.1 --port 5001 --default-radius 1000 --max-viaroute-size 25 \
  --max-table-size 25 --max-nearest-size 25 "/data/$route_base"
