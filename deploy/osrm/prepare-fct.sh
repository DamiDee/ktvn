#!/usr/bin/env bash
# Build a separate FCT dataset without touching the live dataset or app processes.
set -euo pipefail
umask 022
base=/opt/krides-osrm
source_data=$(cat "$base/fct-source-dir")
[[ "$source_data" == "$base"/data/nigeria-* ]] || exit 1
[ -f "$source_data/filter.ok" ] || exit 1
[ -f "$base/boundaries/fct.geojson" ] || exit 1
image=$(cat "$base/image-ref")
[[ "$image" =~ ^ghcr.io/project-osrm/osrm-backend@sha256:[0-9a-f]{64}$ ]] || exit 1
if [ ! -f "$base/fct-build-dir" ]; then
  printf '%s/data/fct-%s\n' "$base" "$(date -u +%Y%m%dT%H%M%SZ)" > "$base/fct-build-dir"
fi
data=$(cat "$base/fct-build-dir")
[[ "$data" == "$base"/data/fct-* ]] || exit 1
[ "$(readlink -f "$base/current")" != "$data" ] || exit 1
install -d -m 0755 "$data"
exec > >(tee -a "$base/logs/fct-preprocess.log") 2>&1
trap 'code=$?; if [ "$code" -ne 0 ]; then printf "failed (%s)\n" "$code" > "$base/fct-build-status"; fi' EXIT
# Dense internal IDs prevent regional extraction indexes from scaling to the
# largest worldwide OSM ID. Coordinates, tags and references remain unchanged.
install -d -m 0755 "$base/source"
compact="$base/source/nigeria-driving.compact.osm.pbf"
source_hash=$(sha256sum "$source_data/nigeria-driving.osm.pbf" | awk '{print $1}')
if [ ! -f "$compact" ] || [ "$(cat "$base/source/compact-source.sha256" 2>/dev/null || true)" != "$source_hash" ]; then
  printf 'compacting build input IDs\n' > "$base/fct-build-status"
  nice -n 19 ionice -c 3 osmium renumber "$source_data/nigeria-driving.osm.pbf" \
    --overwrite -o "$base/source/nigeria-driving.compact.partial.osm.pbf"
  mv "$base/source/nigeria-driving.compact.partial.osm.pbf" "$compact"
  printf '%s\n' "$source_hash" > "$base/source/compact-source.sha256"
fi
if [ ! -f "$data/region.ok" ]; then
  printf 'extracting FCT polygon\n' > "$base/fct-build-status"
  # Complete boundary-crossing roads and turn restrictions to preserve routing.
  nice -n 19 ionice -c 3 osmium extract -p "$base/boundaries/fct.geojson" \
    -s smart -S types=restriction "$compact" \
    --overwrite -o "$data/fct-driving.osm.pbf"
  nice -n 19 ionice -c 3 osmium check-refs "$data/fct-driving.osm.pbf"
  cp "$base/boundaries/fct.geojson" "$data/boundary.geojson"
  touch "$data/region.ok"
fi
phase() {
  local name=$1
  shift
  [ ! -f "$data/$name.ok" ] || return 0
  printf '%s\n' "$name" > "$base/fct-build-status"
  nice -n 19 ionice -c 3 podman run --rm --name "krides-osrm-fct-$name" \
    --network=none --cpus=0.5 --memory=1536m --memory-swap=1536m \
    --pids-limit=128 --cap-drop=ALL --security-opt=no-new-privileges \
    -v "$data:/data" "$image" "$@"
  touch "$data/$name.ok"
}
phase extract osrm-extract --threads 1 -p /opt/car.lua /data/fct-driving.osm.pbf
phase partition osrm-partition --threads 1 /data/fct-driving.osrm
phase customize osrm-customize --threads 1 /data/fct-driving.osrm
chmod 0644 "$data"/fct-driving.osrm.*
python3 - "$data" "$source_data" "$image" <<'PY'
import json,sys,hashlib,datetime
from pathlib import Path
p=Path(sys.argv[1]); source=Path(sys.argv[2]);m=json.loads((source/'manifest.json').read_text())
m.update({'image':sys.argv[3],'builtAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'internalObjectIdsRenumbered':True,'region':'NG-FC','regionName':'Federal Capital Territory','routingBase':'fct-driving.osrm','routingInput':'fct-driving.osm.pbf','boundarySha256':hashlib.sha256((p/'boundary.geojson').read_bytes()).hexdigest(),'extractionStrategy':'smart; types=restriction; complete boundary-crossing ways'})
(p/'manifest.json').write_text(json.dumps(m,indent=2)+'\n')
PY
printf 'ready\n' > "$base/fct-build-status"
echo 'FCT routing dataset ready.'
