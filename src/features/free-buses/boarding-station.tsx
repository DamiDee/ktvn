"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/badge";
import { useLiveUser } from "./live-shell";
import { isOversight } from "@/lib/freebus-contract";
import { RecordsTable } from "@/components/ui/records-table";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Modal } from "@/components/ui/modal";
import { ScanLine, ListChecks, QrCode, Nfc } from "lucide-react";
import { freebusRequest, FreebusError } from "@/services/freebus-api";
import { boardingProblem, qrImageSource, type BookingQr, type BookingVerification } from "@/lib/boarding";
import { queryString } from "@/lib/freebus-contract";
import type { ApiBooking, ApiBus, ApiTrip, ApiUser } from "@/types/freebus-api";
import { useLiveQuery } from "./live-queries";

interface NdefReader {
  scan(options: { signal: AbortSignal }): Promise<void>;
  write(message: string, options: { signal: AbortSignal; overwrite: boolean }): Promise<void>;
  onreading: ((event: { message: { records: { recordType: string; encoding?: string; data: DataView }[] } }) => void) | null;
  onreadingerror: (() => void) | null;
}
function nfcReader(): NdefReader {
  const Constructor = (window as unknown as { NDEFReader?: new () => NdefReader }).NDEFReader;
  if (!Constructor) throw new Error("NFC is unavailable here. Use QR scanning, or Chrome on an NFC-enabled Android device.");
  return new Constructor();
}

async function boardingRequest<T>(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try { return await freebusRequest<T>(path, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export function BoardingStation({ initialBus = "" }: { initialBus?: string }) {
  const user = useLiveUser();
  const oversight = isOversight(user.role);
  const [busId, setBusId] = useState(initialBus);
  const [mode, setMode] = useState<"qr" | "nfc">("qr");
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [tagBooking, setTagBooking] = useState<ApiBooking | null>(null);
  const [tagBusy, setTagBusy] = useState(false);
  const [tagMessage, setTagMessage] = useState("");
  const [tagPayload, setTagPayload] = useState("");
  // Searching the manifest and running a scanner are different jobs; only one at a time.
  const [station, setStation] = useState<"scan" | "manifest">("scan");
  const [qrBooking, setQrBooking] = useState<ApiBooking | null>(null);
  const [qrSrc, setQrSrc] = useState("");
  const [qrMessage, setQrMessage] = useState("");
  const [qrBusy, setQrBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<{ stop(): void } | null>(null);
  const media = useRef<MediaStream | null>(null);
  const abort = useRef<AbortController | null>(null);
  const tagAbort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const lastScan = useRef({ text: "", time: 0 });
  const successful = useRef(new Set<string>());
  const client = useQueryClient();
  const buses = useLiveQuery<ApiBus[]>("buses");
  const bookings = useLiveQuery<ApiBooking[]>(`bookings${queryString({ bus_id: busId })}`, Boolean(busId));
  const users = useLiveQuery<ApiUser[]>("users", Boolean(busId) && oversight);
  function stopDevices() {
    generation.current += 1; controls.current?.stop(); controls.current = null;
    media.current?.getTracks().forEach((track) => track.stop()); media.current = null;
    abort.current?.abort(); abort.current = null;
  }
  function stop() { stopDevices(); setRunning(false); setStarting(false); }
  useEffect(() => {
    const visibility = () => { if (document.hidden) { stopDevices(); setRunning(false); setStarting(false); } };
    document.addEventListener("visibilitychange", visibility);
    return () => { stopDevices(); tagAbort.current?.abort(); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  async function board(booking: ApiBooking, session?: number) {
    if (!booking.trip_id) throw new Error("This older pass has no trip assignment. Ask an admin to resolve it before boarding.");
    const [currentBus, trip] = await Promise.all([boardingRequest<ApiBus>(`buses/${busId}`), boardingRequest<ApiTrip>(`trips/${booking.trip_id}`)]);
    const problem = boardingProblem(booking, currentBus, trip);
    if (problem) throw new Error(problem);
    if (session !== undefined && session !== generation.current) return;
    const boarded = await boardingRequest<ApiBooking>(`bookings/${booking.id}/board`, { method: "PATCH" });
    if (boarded.status !== "Boarded") throw new Error("The server has not confirmed boarding. Check the manifest before retrying.");
    successful.current.add(booking.id);
    const member = users.data?.find((u) => u.id === boarded.user_id);
    setResult({ ok: true, text: `Boarded · Seat ${boarded.seat_number}${member ? ` · ${member.first_name} ${member.last_name}` : ""} · ${boarded.booking_ref}` });
    navigator.vibrate?.(120);
    void client.invalidateQueries({ queryKey: ["freebus-live"] });
  }
  async function processScan(raw: string, session: number) {
    if (session !== generation.current || locked.current || !raw || raw.length > 16000) return;
    if (lastScan.current.text === raw && Date.now() - lastScan.current.time < 5000) return;
    lastScan.current = { text: raw, time: Date.now() };
    locked.current = true; setBusy(true); setResult(null);
    try {
      const verification = await boardingRequest<BookingVerification>("bookings/verify", { method: "POST", body: JSON.stringify({ qr_payload: raw }) });
      if (!verification.valid || !verification.booking_id) throw new Error(verification.message || "This is not a valid pass.");
      if (successful.current.has(verification.booking_id)) throw new Error("This passenger has already boarded.");
      const booking = await boardingRequest<ApiBooking>(`bookings/${verification.booking_id}`);
      if (session !== generation.current) return;
      await board(booking, session);
    } catch (e) {
      const uncertain = e instanceof FreebusError && (e.status === 0 || e.status >= 500 || e.status === 401);
      if (uncertain) stop();
      setResult({ ok: false, text: uncertain ? "Scanner paused: the server response was unavailable. Check the manifest before restarting; boarding may have succeeded." : e instanceof Error ? e.message : "Could not confirm boarding. Check the manifest before retrying." });
      void bookings.refetch();
    } finally { locked.current = false; setBusy(false); }
  }
  async function start() {
    stop(); const session = generation.current;
    setStarting(true); setResult(null);
    try {
      if (!busId) throw new Error("Choose the bus you are boarding first.");
      if (!window.isSecureContext) throw new Error("Scanning needs HTTPS (or localhost for testing).");
      if (mode === "qr") {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (session !== generation.current) return;
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (session !== generation.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        media.current = stream;
        const reader = new BrowserQRCodeReader();
        const scanner = await reader.decodeFromStream(stream, video.current!, (decoded) => { if (decoded) void processScan(decoded.getText(), session); });
        if (session !== generation.current) { scanner.stop(); return; }
        controls.current = scanner;
      } else {
        const reader = nfcReader(); abort.current = new AbortController();
        reader.onreading = (event) => { const record = event.message.records.find((r) => r.recordType === "text"); if (record) void processScan(new TextDecoder(record.encoding || "utf-8").decode(record.data), session); else setResult({ ok: false, text: "This tag has no boarding pass. Switch to QR." }); };
        reader.onreadingerror = () => setResult({ ok: false, text: "Could not read this NFC tag. Try again or switch to QR." });
        await reader.scan({ signal: abort.current.signal });
      }
      if (session === generation.current) setRunning(true);
    } catch (e) { stop(); setResult({ ok: false, text: e instanceof Error ? e.message : "Scanner unavailable. Check permissions or use the manifest." }); }
    finally { setStarting(false); }
  }
  /** Shows the server's signed pass for one passenger, so it can be re-presented. */
  async function showQr(booking: ApiBooking) {
    setQrBooking(booking); setQrSrc(""); setQrBusy(true); setQrMessage("Fetching the signed pass…");
    const controller = new AbortController(); tagAbort.current = controller;
    try {
      const qr = await freebusRequest<BookingQr>(`bookings/${booking.id}/qrcode`, { signal: controller.signal });
      const src = qr.booking_id === booking.id ? qrImageSource(qr.qr_code_base64) : null;
      if (!src) throw new Error("The server did not return a readable signed pass.");
      if (controller.signal.aborted) return;
      setQrSrc(src); setQrMessage("");
    } catch (e) { if (!controller.signal.aborted) setQrMessage(e instanceof Error ? e.message : "Could not load this pass."); }
    finally { setQrBusy(false); }
  }

  async function prepareTag(booking: ApiBooking) {
    setTagBooking(booking); setTagPayload(""); setTagBusy(true); setTagMessage("Preparing signed pass…");
    const controller = new AbortController(); tagAbort.current = controller;
    try {
      // Decode the backend's signed QR locally; write the EXACT same payload to an empty NDEF tag.
      const qr = await freebusRequest<BookingQr>(`bookings/${booking.id}/qrcode`, { signal: controller.signal });
      const src = qr.booking_id === booking.id ? qrImageSource(qr.qr_code_base64) : null;
      if (!src) throw new Error("The server did not return a readable signed pass.");
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const decoded = await new BrowserQRCodeReader().decodeFromImageUrl(src);
      if (controller.signal.aborted) return;
      setTagPayload(decoded.getText());
      setTagMessage("Signed pass ready. Select Write, then hold a blank NFC tag against this device.");
    } catch (e) { if (!controller.signal.aborted) setTagMessage(e instanceof Error ? e.message : "Could not write tag. Use the QR pass."); }
    finally { setTagBusy(false); }
  }
  async function writeTag() {
    if (!tagPayload) return;
    setTagBusy(true);
    const controller = new AbortController(); tagAbort.current = controller;
    try {
      const reader = nfcReader();
      // Invoke from the button gesture, with no network wait before the permission prompt.
      const writing = reader.write(tagPayload, { signal: controller.signal, overwrite: false });
      setTagMessage("Hold a blank NFC tag against this device. Existing tag data will not be overwritten.");
      await writing;
      setTagMessage("Pass saved to tag. Give this tag to the passenger for this booking only.");
    } catch (e) { if (!controller.signal.aborted) setTagMessage(e instanceof Error ? e.message : "Could not write tag. Use the QR pass."); }
    finally { setTagBusy(false); }
  }
  const manifest = (bookings.data ?? []).filter((b) => b.bus_id === busId && b.trip_id === buses.data?.find((bus) => bus.id === busId)?.current_trip_id);
  const boardingBus = buses.data?.find((b) => b.id === busId);
  const memberName = (booking: ApiBooking) => {
    const user = users.data?.find((u) => u.id === booking.user_id);
    return user ? `${user.first_name} ${user.last_name}` : "Member";
  };

  async function boardNow(booking: ApiBooking) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setResult(null);
    try { await board(await freebusRequest<ApiBooking>(`bookings/${booking.id}`)); }
    catch (e) { setResult({ ok: false, text: e instanceof Error ? e.message : "Boarding failed." }); }
    finally { locked.current = false; setBusy(false); }
  }

  return <>
    <PageHeader eyebrow={oversight ? "Free Buses · Oversight" : "Free Buses · Route Coordinator"} title="Boarding" description={station === "scan" ? "Choose a bus, start once, then scan each passenger's pass." : "Find a passenger on this bus and board, show or issue their pass."} />

    <Card className="mb-5">
      <Select label="Boarding bus" value={busId} disabled={busy || starting || running} onChange={(e) => { stop(); setBusId(e.target.value); setResult(null); }} options={[{ value: "", label: "Choose a bus" }, ...(buses.data ?? []).map((b) => ({ value: b.id, label: `${b.license_plate} · ${b.state} · ${b.current_passenger_count}/${b.capacity}` }))]} />
      {buses.error ? <p role="alert" className="mt-2 text-danger-600">{buses.error.message}</p> : null}

      <div role="group" aria-label="Boarding controls" className="my-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={station === "scan" ? "primary" : "secondary"} disabled={busy || starting} aria-pressed={station === "scan"} icon={ScanLine} onClick={() => { stop(); setStation("scan"); }}>Scan passes</Button>
        <Button size="sm" variant={station === "manifest" ? "primary" : "secondary"} disabled={busy || starting} aria-pressed={station === "manifest"} icon={ListChecks} onClick={() => { stop(); setStation("manifest"); }}>Search manifest</Button>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
        <Button size="sm" variant={station === "scan" && mode === "qr" ? "primary" : "ghost"} disabled={busy || starting} aria-pressed={station === "scan" && mode === "qr"} icon={QrCode} onClick={() => { stop(); setStation("scan"); setMode("qr"); }}>QR Camera</Button>
        <Button size="sm" variant={station === "scan" && mode === "nfc" ? "primary" : "ghost"} disabled={busy || starting} aria-pressed={station === "scan" && mode === "nfc"} icon={Nfc} onClick={() => { stop(); setStation("scan"); setMode("nfc"); }}>NFC tag</Button>
      </div>

      {/* The scanner exists only in scan mode: searching the manifest replaces it. */}
      {station === "scan" ? <>
        {mode === "qr" ? <video ref={video} muted playsInline className="mb-4 aspect-video max-h-80 w-full rounded-xl bg-black object-cover" aria-label="QR camera preview" /> : <p className="mb-4 text-sm text-ink-secondary">NDEF tags on supported Android Chrome devices. Phone-to-phone NFC passes are not supported by web browsers. Use QR on other devices.</p>}
        <div className="flex gap-3"><Button disabled={!busId || running || busy} loading={starting} onClick={() => void start()}>Start scanner</Button><Button variant="secondary" disabled={!running && !starting} onClick={stop}>Stop scanner</Button></div>
        <p className="mt-3 text-sm text-ink-muted">{running ? "Scanner active. Verified passes for this bus will board automatically." : "Camera / NFC permission is required once. No extra confirmation per successful scan."}</p>
      </> : (
        <p className="mt-4 text-sm text-ink-muted">The scanner is off while you search. Board a passenger from the manifest below, show their QR pass, or write it to an NFC tag.</p>
      )}

      <div role="status" aria-live="polite" className="mt-4">{busy ? <p className="text-ink">Checking ticket with the server…</p> : result ? <p className={`rounded-xl border p-4 font-semibold ${result.ok ? "border-forest-500 bg-forest-50 text-forest-900 dark:bg-forest-500/12 dark:text-forest-100" : "border-danger-500 text-danger-600"}`}>{result.text}</p> : null}</div>
    </Card>

    <h2 className="mb-3 text-xl font-semibold text-ink">Passenger manifest{boardingBus ? <span className="type-meta ml-2 font-normal text-ink-muted">{boardingBus.license_plate}</span> : null}</h2>
    {!busId ? <p className="text-ink-secondary">Select a bus to see its passengers.</p>
      : bookings.error ? <ErrorState title="Manifest unavailable" description={!oversight && bookings.error instanceof FreebusError && bookings.error.status === 403 ? "The API has not enabled booking access for Route Coordinators yet. Ask the backend team to grant the boarding permissions; this app cannot override them." : bookings.error.message} onRetry={() => void bookings.refetch()} />
      : <RecordsTable
          caption="Passengers on this bus"
          rows={manifest}
          rowKey={(booking) => booking.id}
          searchIn={(booking) => `${memberName(booking)} ${booking.booking_ref} seat ${booking.seat_number} ${booking.status}`}
          searchPlaceholder="Search name, reference or seat"
          initialSort={{ id: "seat", direction: "asc" }}
          empty={<Card radius="xl"><EmptyState icon={ListChecks} size="sm" title="No bookings on this bus" description="Once members reserve a seat they appear here." /></Card>}
          columns={[
            { id: "seat", header: "Seat", meta: true, sortBy: (booking) => booking.seat_number, cell: (booking) => <span className="type-numeric font-semibold text-ink">{booking.seat_number}</span> },
            { id: "member", header: "Passenger", primary: true, sortBy: (booking) => memberName(booking), cell: (booking) => <span className="font-medium text-ink">{memberName(booking)}</span> },
            { id: "reference", header: "Reference", secondary: true, sortBy: (booking) => booking.booking_ref, cell: (booking) => <span className="type-numeric break-all text-ink-secondary">{booking.booking_ref}</span> },
            { id: "status", header: "Status", meta: true, sortBy: (booking) => booking.status, cell: (booking) => <StatusChip tone={booking.status === "Boarded" ? "success" : booking.status === "Confirmed" ? "active" : "neutral"}>{booking.status}</StatusChip> },
            { id: "actions", header: "Actions", align: "end", actions: true, cell: (booking) => <div className="flex flex-wrap justify-end gap-1.5">
              {oversight ? <Button size="sm" variant="ghost" icon={QrCode} onClick={() => void showQr(booking)}>QR code</Button> : null}
              {booking.status === "Confirmed" ? <>
                {oversight ? <Button size="sm" variant="ghost" icon={Nfc} disabled={running || busy || starting} onClick={() => void prepareTag(booking)}>NFC tag</Button> : null}
                <Button size="sm" variant="secondary" disabled={running || busy || starting} onClick={() => void boardNow(booking)}>Board</Button>
              </> : null}
            </div> },
          ]}
        />}

    {busId ? <details className="mt-5"><summary className="cursor-pointer text-sm text-ink-secondary">Board by typing a reference</summary>
      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const reference = String(data.get("reference") ?? "").trim(); const booking = manifest.find((b) => b.booking_ref === reference); if (!booking) { setResult({ ok: false, text: "Reference not found in this bus manifest." }); return; } await boardNow(booking); }}>
        <Input name="reference" label="Booking reference" required placeholder="Exact booking reference" />
        <Button type="submit" disabled={running || busy || starting}>Board by reference</Button>
      </form>
      <p className="mt-3 text-xs text-ink-muted">Check the passenger against the manifest first. A signed QR or NFC pass is the preferred proof.</p>
    </details> : null}

    <Modal open={Boolean(qrBooking)} onClose={() => { tagAbort.current?.abort(); setQrBooking(null); setQrSrc(""); }} title="Boarding pass" description={qrBooking ? `Seat ${qrBooking.seat_number} · ${memberName(qrBooking)}` : undefined}>
      <div className="flex flex-col items-center gap-4">
        {qrSrc ? (
          // A server-signed data: URI — next/image would add nothing but indirection.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrSrc} alt={`Signed boarding pass for ${qrBooking?.booking_ref}`} width={224} height={224} className="size-56 rounded-xl border border-line bg-white p-3" />
        )
          : <div className="flex size-56 items-center justify-center rounded-xl border border-line bg-surface-nested"><QrCode className="size-10 text-ink-muted" aria-hidden /></div>}
        <p className="type-numeric break-all text-center text-ink">{qrBooking?.booking_ref}</p>
        {qrBusy || qrMessage ? <p role="status" className={qrMessage && !qrBusy ? "text-danger-600" : "text-ink-secondary"}>{qrBusy ? "Fetching the signed pass…" : qrMessage}</p> : null}
        <p className="type-meta text-center text-ink-muted">This pass is signed by the server. Anyone holding it can board this seat, so show it only to the booked passenger.</p>
      </div>
    </Modal>

    <Modal open={Boolean(tagBooking)} onClose={() => { tagAbort.current?.abort(); setTagBooking(null); }} title="Prepare a passenger NFC tag"><p className="mb-4 text-ink-secondary">Seat {tagBooking?.seat_number} · {tagBooking?.booking_ref}. Use a blank NDEF tag. Anyone holding it can present this ticket, so hand it only to the booked passenger.</p><p role="status" className="mb-4 text-sm text-ink">{tagMessage}</p><Button loading={tagBusy} disabled={!tagPayload} onClick={() => void writeTag()}>Write signed pass to blank tag</Button></Modal>
  </>;
}
