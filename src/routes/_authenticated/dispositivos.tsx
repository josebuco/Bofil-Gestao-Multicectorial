import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { generateDeviceCode, listDevices, manageDevice } from "@/lib/devices.functions";

export const Route = createFileRoute("/_authenticated/dispositivos")({
  head: () => ({
    meta: [
      { title: "Dispositivos — Bofil" },
      { name: "description", content: "Autorizar e revogar dispositivos com acesso ao portal Bofil." },
      { property: "og:title", content: "Dispositivos — Bofil" },
      { property: "og:description", content: "Autorizar e revogar dispositivos com acesso ao portal Bofil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevicesPage,
});

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }) : "—");

function DevicesPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["devices"], queryFn: () => listDevices(), refetchInterval: 10_000 });
  const [gen, setGen] = useState<{ code: string; expires: string } | null>(null);

  async function act(id: string, action: "approve" | "reject" | "revoke") {
    if (action === "revoke" && !confirm("Revogar o acesso deste dispositivo?")) return;
    try {
      await manageDevice({ data: { id, action } });
      qc.invalidateQueries({ queryKey: ["devices"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const pending = data.filter((d: any) => d.status === "pending");
  const active = data.filter((d: any) => d.status === "approved");

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">Dispositivos</h1>
        <p className="text-sm text-muted-foreground">Só os aparelhos autorizados conseguem abrir o ecrã de entrada.</p>
      </div>

      <section className="rounded-xl border border-edge bg-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Gerar código de activação</h2>
            <p className="text-sm text-muted-foreground">Válido 15 minutos, para usar em "Já tenho um código".</p>
          </div>
          <button
            onClick={async () => setGen(await generateDeviceCode())}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Gerar código
          </button>
        </div>
        {gen && (
          <p className="mt-4 font-display text-4xl tracking-[0.3em]">
            {gen.code} <span className="text-xs tracking-normal text-muted-foreground">até {fmt(gen.expires)}</span>
          </p>
        )}
      </section>

      <section className="rounded-xl border border-edge bg-panel p-5">
        <h2 className="font-semibold mb-3">Pedidos pendentes ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido.</p>}
        {pending.map((d: any) => (
          <div key={d.id} className="flex items-center justify-between border-t border-edge py-3">
            <div>
              <p className="font-display text-xl tracking-[0.25em]">{d.code}</p>
              <p className="text-xs text-muted-foreground">{fmt(d.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => act(d.id, "approve")} className="rounded-md bg-success px-3 py-1.5 text-sm font-semibold text-primary-foreground">Autorizar</button>
              <button onClick={() => act(d.id, "reject")} className="rounded-md border border-edge px-3 py-1.5 text-sm">Recusar</button>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-edge bg-panel p-5">
        <h2 className="font-semibold mb-3">Dispositivos autorizados ({active.length})</h2>
        {active.map((d: any) => (
          <div key={d.id} className="flex items-center justify-between border-t border-edge py-3 text-sm">
            <div>
              <p>Autorizado em {fmt(d.approved_at)}</p>
              <p className="text-xs text-muted-foreground">Último uso: {fmt(d.last_seen_at)}</p>
            </div>
            <button onClick={() => act(d.id, "revoke")} className="rounded-md border border-destructive px-3 py-1.5 text-destructive">Revogar</button>
          </div>
        ))}
      </section>
    </div>
  );
}
