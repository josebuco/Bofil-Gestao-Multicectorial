// Único sítio que liga (ou desliga) a cópia do aplicativo guardada no aparelho.
const SW_URL = "/sw.js";

function blocked() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).has("sw") &&
      new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

export async function unregisterAppSw() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
  await Promise.all(
    regs
      .filter((r) => (r.active?.scriptURL || r.installing?.scriptURL || "").endsWith(SW_URL))
      .map((r) => r.unregister().catch(() => false)),
  );
}

export async function registerAppSw() {
  if (blocked()) {
    await unregisterAppSw();
    return;
  }
  await navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {});
}
