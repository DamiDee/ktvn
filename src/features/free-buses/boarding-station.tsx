"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { Modal } from "@/components/ui/modal";
import { freebusRequest, FreebusError } from "@/services/freebus-api";
import { boardingProblem, qrImageSource, type BookingQr, type BookingVerification } from "@/lib/boarding";
import { queryString } from "@/lib/freebus-contract";
import type { ApiBooking, ApiBus, ApiRoute, ApiUser } from "@/types/freebus-api";
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
  const users = useLiveQuery<ApiUser[]>("users", Boolean(busId));
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
    const [currentBus, route] = await Promise.all([boardingRequest<ApiBus>(`buses/${busId}`), boardingRequest<ApiRoute>(`routes/${booking.route_id}`)]);
    const problem = boardingProblem(booking, currentBus, route);
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
  return <>
    <PageHeader eyebrow="Free Buses · Oversight" title="Boarding" description="Choose a bus, start once, then scan each passenger's pass." />
    <Card className="mb-5"><Select label="Boarding bus" value={busId} disabled={busy || starting || running} onChange={(e) => { stop(); setBusId(e.target.value); setResult(null); }} options={[{ value: "", label: "Choose a bus" }, ...(buses.data ?? []).map((b) => ({ value: b.id, label: `${b.license_plate} · ${b.state} · ${b.current_passenger_count}/${b.capacity}` }))]} />{buses.error ? <p role="alert">{buses.error.message}</p> : null}
      <div className="my-4 flex flex-wrap gap-2"><Button variant={mode === "qr" ? "primary" : "secondary"} disabled={busy || starting} onClick={() => { stop(); setMode("qr"); }}>QR camera</Button><Button variant={mode === "nfc" ? "primary" : "secondary"} disabled={busy || starting} onClick={() => { stop(); setMode("nfc"); }}>NFC tag</Button></div>
      {mode === "qr" ? <video ref={video} muted playsInline className="mb-4 aspect-video max-h-80 w-full rounded-xl bg-black object-cover" aria-label="QR camera preview" /> : <p className="mb-4 text-sm text-ink-secondary">NDEF tags on supported Android Chrome devices. Phone-to-phone NFC passes are not supported by web browsers. Use QR on other devices.</p>}
      <div className="flex gap-3"><Button disabled={!busId || running || busy} loading={starting} onClick={() => void start()}>Start scanner</Button><Button variant="secondary" disabled={!running && !starting} onClick={stop}>Stop scanner</Button></div>
      <p className="mt-3 text-sm text-ink-muted">{running ? "Scanner active. Verified passes for this bus will board automatically." : "Camera / NFC permission is required once. No extra confirmation per successful scan."}</p>
      <div role="status" aria-live="polite" className="mt-4">{busy ? <p>Checking ticket with the server…</p> : result ? <p className={`rounded-xl border p-4 font-semibold ${result.ok ? "border-forest-500 bg-forest-50 text-forest-900" : "border-danger-500 text-danger-600"}`}>{result.text}</p> : null}</div>
    </Card>
    <h2 className="mb-3 text-xl font-semibold text-ink">Passenger manifest</h2>
    {!busId ? <p className="text-ink-secondary">Select a bus to see its passengers.</p> : bookings.error ? <ErrorState title="Manifest unavailable" description={bookings.error.message} onRetry={() => void bookings.refetch()} /> : <>
      <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={async (event) => { event.preventDefault(); if (locked.current) return; const data = new FormData(event.currentTarget); const reference = String(data.get("reference") ?? "").trim(); const booking = bookings.data?.find((b) => b.booking_ref === reference && b.bus_id === busId); if (!booking) { setResult({ ok: false, text: "Reference not found in this bus manifest." }); return; } locked.current = true; setBusy(true); try { const fresh = await freebusRequest<ApiBooking>(`bookings/${booking.id}`); await board(fresh); } catch (e) { setResult({ ok: false, text: e instanceof Error ? e.message : "Boarding failed." }); } finally { locked.current = false; setBusy(false); } }}><Input name="reference" label="Manual reference fallback" required placeholder="Enter exact booking reference" /><Button type="submit" disabled={running || busy || starting}>Board by reference</Button></form>
      <p className="mb-4 text-xs text-ink-muted">For manual boarding, check passenger details against the manifest first. Signed QR/NFC verification is preferred.</p>
      <div className="grid gap-3 sm:grid-cols-2">{bookings.data?.filter((b) => b.bus_id === busId).map((booking) => { const user = users.data?.find((u) => u.id === booking.user_id); return <Card key={booking.id}><h3 className="font-semibold text-ink">Seat {booking.seat_number} · {user ? `${user.first_name} ${user.last_name}` : "Member"}</h3><p className="mt-2 break-all text-sm text-ink-secondary">{booking.booking_ref} · {booking.status}</p>{booking.status === "Confirmed" ? <Button className="mt-3" size="sm" variant="ghost" disabled={running || busy || starting} onClick={() => void prepareTag(booking)}>Prepare NFC tag</Button> : null}</Card>; })}</div>{bookings.data?.length === 0 ? <p className="text-ink-secondary">No bookings on this bus.</p> : null}
    </>}
    <Modal open={Boolean(tagBooking)} onClose={() => { tagAbort.current?.abort(); setTagBooking(null); }} title="Prepare a passenger NFC tag"><p className="mb-4 text-ink-secondary">Seat {tagBooking?.seat_number} · {tagBooking?.booking_ref}. Use a blank NDEF tag. Anyone holding it can present this ticket, so hand it only to the booked passenger.</p><p role="status" className="mb-4 text-sm text-ink">{tagMessage}</p><Button loading={tagBusy} disabled={!tagPayload} onClick={() => void writeTag()}>Write signed pass to blank tag</Button></Modal>
  </>;
}
