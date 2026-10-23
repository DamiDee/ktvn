#!/usr/bin/env bash
# Installs an isolated OCI runtime and temporary build swap; no app restarts.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l
[ "$(id -u)" -eq 0 ] || { echo 'Run as root.' >&2; exit 1; }
[ "$(uname -m)" = x86_64 ] || { echo 'Review image platform first.' >&2; exit 1; }
[ "$(awk '/MemTotal:/{print $2}' /proc/meminfo)" -ge 3800000 ] || { echo 'Review build RAM capacity first.' >&2; exit 1; }
install -d -m 0755 /opt/krides-osrm /opt/krides-osrm/data /opt/krides-osrm/logs
if [ "${KRIDES_SKIP_APT_UPDATE:-0}" != 1 ]; then
  apt-get -o Acquire::ForceIPv4=true update -qq
fi
apt-get -o Acquire::ForceIPv4=true -o DPkg::Lock::Timeout=30 install -y --no-install-recommends podman osmium-tool
# Build-only headroom, not persistent system configuration.
make_build_swap() {
  local path=$1 size=$2
  if swapon --show=NAME --noheadings | grep -Fxq "$path"; then return; fi
  [ ! -e "$path" ] || { echo "Inactive swap already exists: $path; review before reuse." >&2; exit 1; }
  fallocate -l "$size" "$path"
  chmod 0600 "$path"
  mkswap "$path"
  swapon "$path"
}
needed=0
for entry in /opt/krides-osrm/preprocess.swap:4294967296 /opt/krides-osrm/preprocess-extra.swap:8589934592 /opt/krides-osrm/preprocess-extra2.swap:8589934592; do
  if ! swapon --show=NAME --noheadings | grep -Fxq "${entry%:*}"; then
    needed=$((needed + ${entry##*:}))
  fi
done
available=$(df --output=avail -B1 /opt/krides-osrm | tail -n 1)
[ "$available" -gt "$((needed + 12884901888))" ] || { echo 'Insufficient safe build disk headroom.' >&2; exit 1; }
make_build_swap /opt/krides-osrm/preprocess.swap 4G
make_build_swap /opt/krides-osrm/preprocess-extra.swap 8G
make_build_swap /opt/krides-osrm/preprocess-extra2.swap 8G
image=ghcr.io/project-osrm/osrm-backend@sha256:9b83e1f7dd926598c52b38124d521811af0673f6cc3b65ce9be07d6dc079b603
podman pull "$image"
printf '%s\n' "$image" > /opt/krides-osrm/image-ref
podman run --rm --network=none "$image" osrm-routed --help
