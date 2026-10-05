import { useEffect, useState } from "react";
// Fila local de registos feitos sem internet. Guardada no próprio aparelho.
const KEY = "bofil_offline_queue";
export const QUEUE_EVENT = "bofil-queue-changed";

export type QueuedKind = "sector_entry" | "sector_entry_payment" | "water_sale" | "expense" | "stock_usage";
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

/** An entry not yet uploaded can be paid locally without creating a second row. */
export function payQueuedEntry(id: string, payment_method: "Numerário" | "Banco") {
  const queue = readQueue();
  if (!queue.some((item) => item.id === id && item.kind === "sector_entry")) return false;
  writeQueue(queue.map((item) => item.id === id && item.kind === "sector_entry"
    ? { ...item, data: { ...item.data, status: "Pago", payment_method } } : item));
  return true;
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

/** Lista viva dos registos ainda guardados no aparelho. */
export function useQueue(kind?: QueuedKind): QueuedItem[] {
  const [items, setItems] = useState<QueuedItem[]>([]);
  useEffect(() => {
    const upd = () => setItems(readQueue().filter((i) => !kind || i.kind === kind));
    upd();
    window.addEventListener(QUEUE_EVENT, upd);
    window.addEventListener("storage", upd);
    return () => {
      window.removeEventListener(QUEUE_EVENT, upd);
      window.removeEventListener("storage", upd);
    };
  }, [kind]);
  return items;
}
