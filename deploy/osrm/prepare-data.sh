#!/usr/bin/env bash
# One-time MLD preprocessing, isolated from application data and services.
set -euo pipefail
umask 022
base=/opt/krides-osrm
image=$(cat "$base/image-ref")
[[ "$image" =~ ^ghcr.io/project-osrm/osrm-backend@sha256:[0-9a-f]{64}$ ]] || exit 1
if [ ! -f "$base/build-dir" ]; then
  printf '%s/data/nigeria-%s\n' "$base" "$(date -u +%Y%m%dT%H%M%SZ)" > "$base/build-dir"
fi
data=$(cat "$base/build-dir")
[[ "$data" == "$base"/data/nigeria-* ]] || exit 1
if [ -L "$base/current" ] && [ "$(readlink -f "$base/current")" = "$data" ]; then
  echo 'Refusing to preprocess the active serving dataset.' >&2
  exit 1
fi
install -d -m 0755 "$data" "$base/logs"
exec > >(tee -a "$base/logs/preprocess.log") 2>&1
trap 'code=$?; if [ "$code" -ne 0 ]; then printf "failed (%s)\n" "$code" > "$base/build-status"; fi' EXIT
if [ ! -f "$data/download.ok" ]; then
  printf 'downloading\n' > "$base/build-status"
  curl --proto '=https' -fsSL --retry 3 --max-time 60 https://download.geofabrik.de/africa/nigeria-latest.osm.pbf.md5 -o "$data/source.md5"
  curl --proto '=https' -fSL --retry 3 --max-time 1800 https://download.geofabrik.de/africa/nigeria-latest.osm.pbf -o "$data/nigeria-latest.osm.pbf.download"
  python3 - "$data" <<'PY'
import hashlib,re,sys
from pathlib import Path
p=Path(sys.argv[1]); expected=p.joinpath('source.md5').read_text().split()[0]
if not re.fullmatch(r'[0-9a-fA-F]{32}',expected):raise SystemExit('Invalid source checksum')
h=hashlib.md5()
with p.joinpath('nigeria-latest.osm.pbf.download').open('rb') as f:
 for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
if h.hexdigest().lower()!=expected.lower():raise SystemExit('Map checksum mismatch; no preprocessing started')
PY
  mv "$data/nigeria-latest.osm.pbf.download" "$data/nigeria-latest.osm.pbf"
  touch "$data/download.ok"
fi
# Keep all routing ways and restrictions, including their referenced objects/tags.
# Do not use --omit-referenced or --remove-tags: traffic signals/barriers matter.
if [ ! -f "$data/filter.ok" ]; then
  printf 'filtering routing data\n' > "$base/build-status"
  systemd-run --unit=krides-osrm-filter --wait --collect --pipe \
    -p MemoryMax=2048M -p MemorySwapMax=2G -p CPUQuota=75% \
    -p Nice=19 -p IOSchedulingClass=idle \
    /usr/bin/osmium tags-filter "$data/nigeria-latest.osm.pbf" \
    w/highway w/route r/type=restriction r/route \
    --output-header='osmosis_replication_timestamp!' \
    --overwrite -o "$data/nigeria-driving.partial.osm.pbf"
  nice -n 19 ionice -c 3 osmium check-refs "$data/nigeria-driving.partial.osm.pbf"
  mv "$data/nigeria-driving.partial.osm.pbf" "$data/nigeria-driving.osm.pbf"
  touch "$data/filter.ok"
fi
run_phase() {
  local phase=$1
  shift
  if [ -f "$data/$phase.ok" ]; then return; fi
  printf '%s\n' "$phase" > "$base/build-status"
  nice -n 19 ionice -c 3 podman run --rm --name "krides-osrm-$phase" \
    --network=none --cpus=0.75 --cpu-shares=128 --memory=2816m --memory-swap=20g \
    --pids-limit=128 --cap-drop=ALL --security-opt=no-new-privileges \
    -v "$data:/data" "$image" "$@"
  touch "$data/$phase.ok"
}
run_phase extract osrm-extract --threads 1 -p /opt/car.lua /data/nigeria-driving.osm.pbf
run_phase partition osrm-partition --threads 1 /data/nigeria-driving.osrm
run_phase customize osrm-customize --threads 1 /data/nigeria-driving.osrm
# Container-created files may inherit a restrictive umask. The serving process
# runs as UID 65534 with a read-only mount and needs read access to the dataset.
chmod 0644 "$data"/nigeria-driving.osrm.*
python3 - "$data" "$image" <<'PY'
import hashlib,json,sys,datetime
from pathlib import Path
p=Path(sys.argv[1]); h=hashlib.sha256()
with p.joinpath('nigeria-latest.osm.pbf').open('rb') as f:
 for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
p.joinpath('manifest.json').write_text(json.dumps({'image':sys.argv[2],'source':'https://download.geofabrik.de/africa/nigeria-latest.osm.pbf','sourceSha256':h.hexdigest(),'builtAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'profile':'car','algorithm':'mld','routingInput':'nigeria-driving.osm.pbf','filter':['w/highway','w/route','r/type=restriction','r/route'],'referencedObjectsAndTagsPreserved':True},indent=2)+'\n')
PY
printf 'ready\n' > "$base/build-status"
echo 'Nigeria routing dataset is ready for serving.'
