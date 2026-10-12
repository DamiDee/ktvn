"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { trackRideEvent } from "../analytics";
import { supportsCanvasCapture, supportsDocumentPiP, supportsVideoPiP } from "../capabilities";
import { drawTrackerFrame, type TrackerFrame } from "./trip-canvas";

/**
 * Picture-in-Picture as progressive enhancement.
 *
 * Strategy A — Document PiP (Chromium desktop): a small always-on-top
 *   window rendered with React (portal) — ETA, status, mini-map, "Back to
 *   trip".
 * Strategy B — video PiP: the canvas tracker is captured as a stream into a
 *   hidden <video>, which is put into PiP. Works where `captureStream` and
 *   video PiP both exist.
 * Otherwise unsupported: callers offer notifications instead.
 *
 * PiP always starts from a user gesture, and it is only a view: the ride
 * keeps its truth on the server and in the realtime session, never here.
 */

type DocumentPiP = {
  requestWindow(options: { width: number; height: number; disallowReturnToOpener?: boolean }): Promise<Window>;
  window: Window | null;
};

export type PipMode = "document" | "video" | null;

export function pipStrategy(): "document" | "video" | "none" {
  if (supportsDocumentPiP()) return "document";
  if (supportsVideoPiP() && supportsCanvasCapture()) return "video";
  return "none";
}

const VIDEO_SIZE = { width: 480, height: 270 };
const REDRAW_MS = 500;

function copyStyles(target: Document): void {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n");
      const style = target.createElement("style");
      style.textContent = css;
      target.head.appendChild(style);
    } catch {
      // Cross-origin sheet (e.g. web fonts): link it instead.
      if (sheet.href) {
        const link = target.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.head.appendChild(link);
      }
    }
  }
}

export function usePictureInPicture(frame: TrackerFrame | null) {
  const [mode, setMode] = useState<PipMode>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const frameRef = useRef(frame);
  const video = useRef<{ element: HTMLVideoElement; canvas: HTMLCanvasElement; timer: ReturnType<typeof setInterval> } | null>(null);
  const windowRef = useRef<Window | null>(null);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  const close = useCallback(() => {
    windowRef.current?.close();
    windowRef.current = null;
    if (video.current) {
      clearInterval(video.current.timer);
      if (document.pictureInPictureElement === video.current.element) void document.exitPictureInPicture().catch(() => undefined);
      video.current.element.srcObject = null;
      video.current.element.remove();
      video.current = null;
    }
    setPipWindow(null);
    setMode(null);
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    const strategy = pipStrategy();
    try {
      if (strategy === "document") {
        const api = (window as unknown as { documentPictureInPicture: DocumentPiP }).documentPictureInPicture;
        const opened = await api.requestWindow({ width: 340, height: 236 });
        copyStyles(opened.document);
        opened.document.documentElement.className = document.documentElement.className;
        opened.document.title = "K-Rides trip";
        opened.addEventListener("pagehide", () => {
          windowRef.current = null;
          setPipWindow(null);
          setMode(null);
        });
        windowRef.current = opened;
        setPipWindow(opened);
        setMode("document");
        trackRideEvent("pip_enabled", { strategy });
        return true;
      }
      if (strategy === "video") {
        const canvas = document.createElement("canvas");
        canvas.width = VIDEO_SIZE.width;
        canvas.height = VIDEO_SIZE.height;
        const context = canvas.getContext("2d");
        if (!context) return false;
        const draw = () => {
          if (frameRef.current) drawTrackerFrame(context, canvas.width, canvas.height, frameRef.current, true);
        };
        draw();
        const element = document.createElement("video");
        element.muted = true;
        element.playsInline = true;
        element.srcObject = canvas.captureStream(4);
        element.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;";
        document.body.appendChild(element);
        await element.play();
        await element.requestPictureInPicture();
        const timer = setInterval(draw, REDRAW_MS);
        video.current = { element, canvas, timer };
        element.addEventListener("leavepictureinpicture", () => {
          clearInterval(timer);
          element.remove();
          video.current = null;
          setMode(null);
        });
        setMode("video");
        trackRideEvent("pip_enabled", { strategy });
        return true;
      }
    } catch {
      close();
    }
    return false;
  }, [close]);

  // Never leave a floating window behind when the screen unmounts.
  useEffect(() => () => close(), [close]);

  return { mode, strategy: pipStrategy(), enable, close, pipWindow };
}

/** Renders children into the Document PiP window. */
export function PipPortal({ pipWindow, children }: { pipWindow: Window | null; children: ReactNode }) {
  if (!pipWindow) return null;
  return createPortal(children, pipWindow.document.body);
}
