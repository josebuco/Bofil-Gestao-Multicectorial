// Fila local de registos feitos sem internet. Guardada no próprio aparelho.
const KEY = "bofil_offline_queue";
export const QUEUE_EVENT = "bofil-queue-changed";

export type QueuedKind = "sector_entry" | "water_sale" | "expense";
export type QueuedItem = { id: string; kind: QueuedKind; data: Record<string, unknown>; at: string; label: string };

export function readQueue(): QueuedItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function writeQueue(items: QueuedItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function enqueue(kind: QueuedKind, data: Record<string, unknown>, label: string) {
  const at = new Date().toISOString();
  writeQueue([...readQueue(), { id: crypto.randomUUID(), kind, data: { ...data, recorded_at: at }, at, label }]);
}

export function isNetworkError(e: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return e instanceof TypeError || /fetch|network|load failed|conex/i.test(msg);
}

/** Envia para a nuvem; se não houver internet, guarda no aparelho. */
export async function sendOrQueue(
  kind: QueuedKind,
  data: Record<string, unknown>,
  label: string,
  send: () => Promise<unknown>,
): Promise<"sent" | "queued"> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueue(kind, data, label);
    return "queued";
  }
  try {
    await send();
    return "sent";
  } catch (e) {
    if (isNetworkError(e)) {
      enqueue(kind, data, label);
      return "queued";
    }
    throw e;
  }
}
