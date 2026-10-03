import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSectorDebt } from "@/lib/transfers.functions";
import { SECTOR_LABELS } from "@/lib/finance.functions";
import { formatMoney } from "@/components/panel";

type S = "agua" | "restaurante" | "lavagem" | "transporte" | "aluguer" | "geral";

export function DebtCard({ sector }: { sector: S }) {
  const fn = useServerFn(getSectorDebt);
  const q = useQuery({ queryKey: ["transfers", "debt", sector], queryFn: () => fn({ data: { sector } }) });
  const owes = q.data?.owes || [];
  const receives = q.data?.receives || [];
  if (!owes.length && !receives.length) return null;
  const total = owes.reduce((s, o) => s + o.amount, 0);
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {owes.length ? (
        <div className="rounded-xl bg-panel ring-1 ring-destructive/40 p-5">
          <p className="text-muted-foreground text-xs uppercase tracking-[0.14em]">Por devolver (cedências recebidas)</p>
          <p className="mt-2 font-display text-3xl text-destructive">{formatMoney(total)} Kz</p>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {owes.map((o) => <li key={o.sector}>A {SECTOR_LABELS[o.sector] || o.sector}: {formatMoney(o.amount)} Kz</li>)}
          </ul>
        </div>
      ) : null}
      {receives.length ? (
        <div className="rounded-xl bg-panel ring-1 ring-edge p-5">
          <p className="text-muted-foreground text-xs uppercase tracking-[0.14em]">A receber (cedências feitas)</p>
          <p className="mt-2 font-display text-3xl text-success">{formatMoney(receives.reduce((s, o) => s + o.amount, 0))} Kz</p>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {receives.map((o) => <li key={o.sector}>De {SECTOR_LABELS[o.sector] || o.sector}: {formatMoney(o.amount)} Kz</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
