import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CloudOff, CloudUpload, Wifi } from "lucide-react";
import { QUEUE_EVENT, isNetworkError, readQueue, writeQueue, type QueuedItem } from "@/lib/offline";
import { addSectorEntry, paySectorEntry } from "@/lib/access.functions";
import { createWaterSale } from "@/lib/crud.functions";
import { createExpense } from "@/lib/expenses.functions";
import { createStockUsage } from "@/lib/rental.functions";

async function sendItem(item: QueuedItem) {
  const data = item.data as never;
  if (item.kind === "sector_entry") return addSectorEntry({ data });
  if (item.kind === "sector_entry_payment") return paySectorEntry({ data });
  if (item.kind === "water_sale") return createWaterSale({ data });
  if (item.kind === "stock_usage") return createStockUsage({ data });
  return createExpense({ data });
}

let flushing = false;
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  if (flushing) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    for (const item of readQueue()) {
      try {
        await sendItem(item);
        writeQueue(readQueue().filter((i) => i.id !== item.id));
        sent++;
      } catch (e) {
        if (isNetworkError(e)) break;
        failed++;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
}

export function OfflineBar() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(true);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  async function sync(manual: boolean) {
    if (!navigator.onLine) {
      if (manual) toast.error("Sem internet. Ligue o Wi-Fi para sincronizar.");
      return;
    }
    if (readQueue().length === 0) {
      if (manual) toast.success("Tudo sincronizado.");
      return;
    }
    setBusy(true);
    const r = await flushQueue();
    setBusy(false);
    if (r.sent) {
      toast.success(`${r.sent} registo(s) enviados para a nuvem.`);
      await qc.invalidateQueries();
    }
    if (r.failed) toast.error(`${r.failed} registo(s) não foram aceites. Tente de novo.`);
  }

  useEffect(() => {
    const upd = () => {
      setOnline(navigator.onLine);
      setCount(readQueue().length);
    };
    const goOnline = () => {
      upd();
      void sync(false);
    };
    upd();
    if (navigator.onLine) void sync(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", upd);
    window.addEventListener(QUEUE_EVENT, upd);
    window.addEventListener("storage", upd);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", upd);
      window.removeEventListener(QUEUE_EVENT, upd);
      window.removeEventListener("storage", upd);
    };
  }, []);

  if (online && count === 0) return null;

  return (
    <div
      className={`flex items-center gap-3 px-6 py-2 text-sm border-b ${
        online ? "bg-success/10 border-success/30 text-success" : "bg-warning/10 border-warning/30 text-warning"
      }`}
    >
      {online ? <Wifi className="size-4" /> : <CloudOff className="size-4" />}
      <span className="flex-1">
        {online ? "Online" : "Sem internet — os registos ficam guardados neste aparelho"}
        {count > 0 && ` · ${count} por enviar`}
      </span>
      {count > 0 && (
        <button
          onClick={() => sync(true)}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md px-3 py-1 ring-1 ring-current font-medium disabled:opacity-50"
        >
          <CloudUpload className="size-4" /> {busy ? "A enviar…" : "Sincronizar"}
        </button>
      )}
    </div>
  );
}
