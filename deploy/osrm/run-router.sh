#!/usr/bin/env bash
set -euo pipefail
base=/opt/krides-osrm
image=$(cat "$base/image-ref")
[[ "$image" =~ ^ghcr.io/project-osrm/osrm-backend@sha256:[0-9a-f]{64}$ ]] || exit 1
data=$(readlink -f "$base/current")
[[ "$data" == "$base"/data/nigeria-* ]] || exit 1
[ -f "$data/customize.ok" ] || exit 1
python3 - "$data/manifest.json" "$image" <<'PY_CHECK'
import json,sys
with open(sys.argv[1]) as f: metadata=json.load(f)
if metadata.get('image')!=sys.argv[2] or metadata.get('algorithm')!='mld':
    raise SystemExit('The engine and prepared dataset must match.')
PY_CHECK
exec /usr/bin/podman run --rm --pull=never --name krides-osrm \
  --network=host --read-only --user=65534:65534 \
  --cap-drop=ALL --security-opt=no-new-privileges --pids-limit=128 \
  --cpus=0.75 --memory=1536m --memory-swap=1536m \
  -v "$data:/data:ro" "$image" \
  osrm-routed --algorithm mld --mmap --threads 1 --verbosity WARNING \
  --ip 127.0.0.1 --port 5001 --default-radius 1000 --max-viaroute-size 25 \
  --max-table-size 25 --max-nearest-size 25 /data/nigeria-driving.osrm
