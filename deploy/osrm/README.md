# K-Rides OSRM on Hostinger

Host: `76.13.42.145` (Ubuntu 24.04, x86-64, 1 CPU, 4 GB RAM).
The owner verified the ED25519 host fingerprint:
`SHA256:ud+50iySp5XmUGKsbP+8vHzSawiw2EFVGEqHGJylHbY`.
Dedicated owner-authorized SSH access works. Private keys are not part of this repository.

## Deployment status

Live and verified on 2026-10-23 (Africa/Lagos). FCT road routing serves the
hosted app and local preview. The Android WebView uses the hosted integration
without an APK rebuild. All three temporary build swap files have been removed;
the final FCT host check showed 3,101 MiB available RAM and 34 GiB free disk.
The active regional dataset is about 103 MiB. Retiring 26 unused national routing
files freed 3.40 GiB; retained source/build inputs bring total map storage to about
1.04 GiB. See [BACKEND_HANDOFF.md](BACKEND_HANDOFF.md) for the developer's API URL.

The engine is the published official `v26.6.1-amd64-alpine` image, pinned as:

```
ghcr.io/project-osrm/osrm-backend@sha256:9b83e1f7dd926598c52b38124d521811af0673f6cc3b65ce9be07d6dc079b603
```

The newer GitHub source release did not yet have a corresponding published image.
The official image is run with Podman, avoiding a new Docker daemon and Docker
network/firewall changes. Existing application packages were not upgraded, and
package installation deferred unrelated service restarts. An unrelated existing
package-index update was left running; installation used the available index.

## Components

- `/opt/krides-osrm/image-ref`: exact image digest used for preprocessing/serving.
- `/opt/krides-osrm/data/fct-<UTC timestamp>/`: active regional map and MLD files.
- `/opt/krides-osrm/data/nigeria-<UTC timestamp>/`: retained original source inputs.
- `/opt/krides-osrm/boundaries/fct.geojson`: OSM `NG-FC` administrative polygon.
- `/opt/krides-osrm/fct-build-dir`, `fct-build-status`: regional staging path/status.
- `/opt/krides-osrm/logs/fct-preprocess.log`: regional preprocessing log.
- `/opt/krides-osrm/build-dir`: staging dataset path.
- `/opt/krides-osrm/current`: active dataset symlink, set only after preprocessing.
- `/opt/krides-osrm/logs/preprocess.log`: extract/partition/customize output.
- `/opt/krides-osrm/build-status`: current build phase or failure status.
- `/opt/krides-osrm/backups/`: nginx and app configuration backups.
- `krides-osrm-prepare.service`: one-time data build; not enabled as a scheduled job.
- `krides-osrm.service`: the routing server, enabled at boot after verification.

The following national-build details are historical; the active FCT build uses
`prepare-fct.sh` and no swap. `bootstrap-host.sh` installs Podman and creates 20 GiB of temporary, owner-only
build swap in three files. It is not added to `/etc/fstab`; remove it after the build when memory
headroom permits. `prepare-data.sh` downloads Nigeria's PBF over HTTPS, verifies
Geofabrik's checksum, then runs car-profile extract, partition and customize.
The source PBF checksum, image digest and build time are recorded in `manifest.json`.
Both the initial unfiltered extraction and the first filtered build hit the container's combined memory allowance (exit 137) while
other services remained healthy. The adjusted pipeline uses `osmium tags-filter`
to retain `w/highway`, `w/route`, `r/type=restriction` and `r/route`, together with
all referenced objects and their tags. This excludes unrelated building/land-use
geometry without cropping country coverage or dropping road-node barriers/signals.
`osmium check-refs` validates way-node references before OSRM extraction.
Filtering has a separate 2 GiB RAM cap and 0.75 CPU limit. The national graph
expansion required more build headroom, so a second temporary swap file was added
while retaining a physical-RAM cap. Extraction was later adjusted from 2.5 to
2.75 GiB after verifying at least 512 MiB of available host RAM, to reduce swapping. All three swap files are build-only. A third file extended the running build
without discarding completed work or increasing physical RAM/CPU limits.

Preprocessing is capped at 0.75 CPU, 2.75 GiB RAM, 20 GiB combined RAM/swap, with
low CPU/I/O priority. It does not use an application database or volume.
The serving container runs as UID 65534 with a read-only filesystem/data mount,
no extra capabilities and memory-mapped routing files. The active FCT service has
a 512 MiB memory cap and 0.5 CPU quota; the older Nigeria configuration allowed
1.5 GiB and 0.75 CPU.

The FCT polygon came from `r/ISO3166-2=NG-FC` in the verified source PBF, exported
with `osmium export --geometry-types=polygon`. The first polygon extraction hit
its 2.25 GiB job limit because indexes scaled with worldwide OSM object IDs.
The corrected build uses `osmium renumber` on a separate routing-input copy,
preserving coordinates, tags and references. IDs in this derived dataset are
internal, not original upstream OSM IDs. Never upload the derived file to OSM.
`osmium extract -s smart -S types=restriction` retains complete boundary-crossing
roads and turn restrictions. `osmium check-refs` passed before OSRM processing.
The corrected build ran with a 0.5 CPU quota, 2.25 GiB parent memory cap, and
1.5 GiB container cap, without swap. The live app remained available.

## Routing and app configuration

The private service address is `http://127.0.0.1:5001`.
`run-router.sh` limits routes to 25 locations and snapping to 1,000 metres, so
outside-country coordinates are not silently routed from a faraway Nigeria road.
The port must remain loopback-only.

`configure-proxy.py` adds only this path to the existing HTTPS site:

```
https://app.freebus.cloud/routing/route/v1/driving/<lng,lat;lng,lat>
```

It allows GET/HEAD driving-route requests, applies a 5 requests/second per-IP
limit with a burst of 20, and returns 404 for other `/routing/` services. It backs
up the nginx site, checks syntax before graceful reload, and restores the
configuration if validation/reload fails. No new DNS or certificate is needed.

`connect-web-app.py` writes only the routing setting to the existing web app's
`/root/ktvn/.env.production.local`:

```
ROUTING_API_BASE_URL=http://127.0.0.1:5001
```

It restarts only the PM2 `ktvn` app, checks its normalized route response and
rolls back the setting if that fails. It does not deploy this repository's other
frontend changes, reset the production checkout or change the backend service.
The production checkout has modified `package.json` and `package-lock.json`;
these were not overwritten by the routing deployment.

The first web restart exposed an existing build/runtime mismatch: installed Next
16.4.2 expected a preview manifest absent from the deployed build, then returned
`previewModeId` errors. The running app was recovered with Next 16.3.4, matching
the committed dependency lock, while preserving the 16.4.2 package under
`/opt/krides-osrm/backups/runtime-recovery/next-16.4.2`. The missing preview file
was restored from the build's original prerender metadata without changing its
keys. The installed SWC package remains 16.4.2 and logs a version warning; the
running app passes the checks below. Before the next app deployment, install a
consistent dependency set and build a fresh release together in staging. Do not
replace dependencies under the serving build or reinstall them and restart it
without a matching build. Preview keys and environment backups must stay private.

For local development using this VPS, configure:

```
ROUTING_API_BASE_URL=https://app.freebus.cloud/routing
```

This is a server environment setting, not a browser-visible key. The Android
WebView uses the hosted site's proxy and requires no APK rebuild for this change.

## Verification

Verified through public HTTPS and the application's normalized proxy:

| Route | Geometry points | Distance | Estimated duration |
| --- | ---: | ---: | ---: |
| Abuja, Jabi–Wuse | 151 | 7,601 m | 516 s |
| Gwagwalada–Abuja | 647 | 55,903 m | 2,654 s |
| Kuje–Abuja | 598 | 41,117 m | 2,154 s |

Both endpoints returned identical geometry and matching rounded metrics. The
local preview on port 3017 also returned the same Abuja route. Invalid coordinates
returned 400, unexposed services 404, write requests 403, and London locations
`NoSegment` rather than a distant FCT route. Lagos now returns `NoSegment` too;
the earlier national deployment's Lagos success is no longer expected. Login returned 200 after the
web restart and final cleanup. Port 5001 listens only on 127.0.0.1; the routing
service is enabled at boot and had zero restarts at the final check.

The original national dataset was built at `2026-10-22T23:01:26Z`, from the Geofabrik Nigeria extract with
source timestamp `2026-10-21T20:21:46Z` and SHA-256:
`67249ca4e4948df07e60bbe83ac1de47d94457a4d614f984faed36338f57e2c4`.

Run `verify-routing.py --region fct` after connecting the service and app. It checks Abuja,
Gwagwalada and Kuje through both HTTPS endpoints, including exact geometry and
rounded distance/time agreement. It also checks invalid coordinates, rejected
write methods, unexposed table routing, outside-country snapping and the existing
login page. Inspect `ss -lnt` to confirm that port 5001 is loopback-only, and
`systemctl is-enabled krides-osrm` to confirm startup persistence.

No account, booking, driver-presence or payment mutation is part of these checks.
Live traffic and spoken navigation are not supplied by this setup.

## Operations and future map updates

For FCT updates, retain/refetch the verified Nigeria source, regenerate the
`NG-FC` polygon, and point `fct-source-dir` at the filtered national input folder.
Set `fct-build-dir` to a **new** staging directory and run `prepare-fct.sh` with
the same resource limits as the last build. The compact input cache is
keyed by the filtered source checksum and is rebuilt when that source changes.
Validate on a temporary loopback service before atomically switching `current`.
The initial national derived files were retired after FCT verification; their
retirement report is `backups/national-derived-retired.json`. Restoring national
coverage now requires rebuilding it from the retained source; changing a symlink
alone cannot restore those deleted files.

Coverage retains complete boundary-crossing roads and is not a strict legal
geofence. If bookings must enforce FCT endpoint boundaries, validate the polygon
in the booking backend. Serving a smaller graph does not enforce booking policy.

Automatic failover is prepared in the local frontend source using
`ROUTING_FALLBACK_API_BASE_URL`, but has not been deployed/enabled in production:
the owner has no approved backup provider. Public demo hosts are rejected in
production. Tests cover primary success, backup on network/timeout/429/5xx/invalid
responses, cooldown/recovery, and preserving coverage errors. See the handoff for
failure behavior and why a shared-VPS outage needs an independently hosted backup.

Inspect with `systemctl status krides-osrm`, `journalctl -u krides-osrm` and
`cat /opt/krides-osrm/current/manifest.json`. Do not expose private keys or
application environment files when sharing diagnostics.

Map updates are manual, not scheduled. Build a new versioned directory, set
`build-dir` to that staging directory and run the preparation service. Never
preprocess `current` in place. Keep the exact image digest compatible with the
new dataset; switching engine images can require rebuilding all MLD files.
After a staging build passes checks, switch `current` atomically and restart
only `krides-osrm`. Keep the previous dataset for rollback.
The initial build took over an hour on this small VPS. A fresh country build
needs temporary disk and memory headroom in addition to the running service;
do not assume the existing host can safely build and serve simultaneously.
Generated `.osrm.*` files must be readable by UID 65534; `prepare-data.sh` sets
their mode to 0644 before marking the dataset ready.

To roll back an engine/data update, restore the previous `current` symlink and
matching image reference, then restart the routing service. To undo the initial
web integration, restore the backed-up nginx site, remove only the task-created
limit configuration, validate/reload nginx, and restore the routing environment
setting before restarting only `ktvn`. Preserve later unrelated configuration edits.

Official references:
- [OSRM container and MLD pipeline](https://github.com/Project-OSRM/osrm-backend#quick-start)
- [Nigeria source data](https://download.geofabrik.de/africa/nigeria.html)
