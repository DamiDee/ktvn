# Hostinger VPS: OSRM preparation

Host supplied by the owner: `76.13.42.145`, SSH user `root`.
The owner verified the server's ED25519 fingerprint:
`SHA256:ud+50iySp5XmUGKsbP+8vHzSawiw2EFVGEqHGJylHbY`.
SSH authentication from this workstation was rejected (`publickey,password`).
No VPS login, installation, download, service change or production deployment
has been performed. OS and available resources have not yet been inspected.

If working in Hostinger's browser terminal, first run these read-only commands
and provide the output (no password, keys or environment files):

```sh
cat /etc/os-release
uname -m
getconf _NPROCESSORS_ONLN
free -m
df -h / /var
command -v docker
command -v nginx
command -v caddy
```

If Docker exists, also run:

```sh
docker --version
docker compose version
docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'
```

`inspect-host.sh` collects the same information plus relevant listening ports.
It is read-only and does not expose container environment variables or secrets.

After resource inspection, plan an isolated OSRM service using Nigeria road data,
a pinned official OSRM container, the car profile and the MLD preprocessing
pipeline (extract, partition, customize, then routed). Preprocessing has different
resource requirements from serving; budget both without starving the existing
API. Check capacity before downloading or running national-data preparation.
Keep preprocessing data separate from active backend volumes and preserve the
exact image version/digest used to generate the serving dataset.

Bind OSRM to a free loopback port (proposed 127.0.0.1:5001) and connect it through
the existing reverse proxy. Do not open the raw routing port to the internet.
If the web app is on a different host, provide an HTTPS routing hostname; do not
configure that remote app to call its own 127.0.0.1 by mistake. Once reachable,
set the web host's `ROUTING_API_BASE_URL` to the OSRM base URL and redeploy.
Validate real Abuja routes and unavailable-router behavior before enabling it.
A routing hostname/DNS and existing proxy configuration still need to be checked.

Official pipeline: https://github.com/Project-OSRM/osrm-backend#quick-start
Data provider: https://download.geofabrik.de/
Public demo restrictions: https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
