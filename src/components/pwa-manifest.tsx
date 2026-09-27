import { useEffect } from "react";

const FLAG = "bofil_device_ok";
export const DEVICE_APPROVED_EVENT = "bofil-device-approved";

export function markDeviceApproved() {
  if (typeof window === "undefined") return;
  localStorage.setItem(FLAG, "1");
  window.dispatchEvent(new Event(DEVICE_APPROVED_EVENT));
}

export function clearDeviceApproved() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FLAG);
  document.getElementById("bofil-manifest")?.remove();
}

/**
 * Only exposes the web app manifest (and therefore the browser's
 * install/download option) once this device has been authorised.
 */
export function PwaManifestGate() {
  useEffect(() => {
    const block = (e: Event) => {
      if (localStorage.getItem(FLAG) !== "1") e.preventDefault();
    };
    window.addEventListener("beforeinstallprompt", block);

    const sync = () => {
      const ok = localStorage.getItem(FLAG) === "1";
      const existing = document.getElementById("bofil-manifest");
      if (ok && !existing) {
        const link = document.createElement("link");
        link.id = "bofil-manifest";
        link.rel = "manifest";
        link.href = "/manifest.webmanifest";
        document.head.appendChild(link);
      } else if (!ok && existing) {
        existing.remove();
      }
      const inIframe = window.self !== window.top;
      const isPreview = /id-preview--|lovableproject\.com/.test(location.hostname);
      if ("serviceWorker" in navigator && import.meta.env.PROD && !inIframe && !isPreview) {
        if (ok) navigator.serviceWorker.register("/sw.js").catch(() => {});
        else
          navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      }
    };

    sync();
    window.addEventListener(DEVICE_APPROVED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("beforeinstallprompt", block);
      window.removeEventListener(DEVICE_APPROVED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return null;
}
