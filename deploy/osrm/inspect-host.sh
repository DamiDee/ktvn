#!/usr/bin/env bash
# Read-only Linux host inspection. Does not install packages or change services.
set -eu
printf 'Operating system\n'
cat /etc/os-release
printf '\nArchitecture and CPU count\n'
uname -m
getconf _NPROCESSORS_ONLN
printf '\nMemory\n'
free -m
printf '\nDisk space\n'
df -h / /var
printf '\nExisting Docker services\n'
if command -v docker >/dev/null 2>&1; then
  docker --version
  docker compose version || true
  docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'
else
  printf 'Docker is not installed.\n'
fi
printf '\nWeb server availability\n'
command -v nginx || true
command -v caddy || true
printf '\nPorts used by web and proposed routing services\n'
if command -v ss >/dev/null 2>&1; then
  ss -lnt | awk 'NR == 1 || $4 ~ /:(80|443|5000|5001)$/'
fi
