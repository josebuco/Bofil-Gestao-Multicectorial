import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Trash2 } from "lucide-react";
import { Card, Field, PageHeader, formatMoney, inputClass } from "@/components/panel";
import { SECTOR_LABELS } from "@/lib/finance.functions";
import { createTransfer, deleteTransfer, listTransfers, returnTransfer } from "@/lib/transfers.functions";
import { todayAngola } from "@/lib/tz";
import { listAllAssets } from "@/lib/rental.functions";

export const Route = createFileRoute("/_authenticated/cedencias")({
  head: () => ({
    meta: [
      { title: "Cedências entre Setores — Bofil" },
      { name: "description", content: "Valores cedidos entre setores, a receber e a pagar." },
      { property: "og:title", content: "Cedências entre Setores — Bofil" },
      { property: "og:description", content: "Valores cedidos entre setores, a receber e a pagar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CedenciasPage,
});

type Method = "Numerário" | "Banco";
const slugs = Object.keys(SECTOR_LABELS);

function CedenciasPage() {
  const qc = useQueryClient();
  const list = useServerFn(listTransfers);
  const create = useServerFn(createTransfer);
  const giveBack = useServerFn(returnTransfer);
  const remove = useServerFn(deleteTransfer);
  const q = useQuery({ queryKey: ["transfers"], queryFn: () => list() });
  const assetsFn = useServerFn(listAllAssets);
  const assets = useQuery({ queryKey: ["all-assets"], queryFn: () => assetsFn() });
  const [saving, setSaving] = useState(false);
  const [retFor, setRetFor] = useState<string | null>(null);
  const [from, setFrom] = useState(slugs[0]);
  const fromAssets = (assets.data || []).filter((a) => a.sector === from);
  const assetName = Object.fromEntries((assets.data || []).map((a) => [a.id, a.name]));

  async function refresh() {
    await Promise.all([qc.invalidateQueries({ queryKey: ["transfers"] }), qc.invalidateQueries({ queryKey: ["finance"] }), qc.invalidateQueries({ queryKey: ["dashboard"] })]);
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setSaving(true);
    try {
      await create({
        data: {
          from_sector: String(f.get("from")) as never,
          to_sector: String(f.get("to")) as never,
          amount: (Math.round(Number(f.get("amount")) * 100) / 100),
          payment_method: String(f.get("method")) as Method,
          note: String(f.get("note") || "").trim() || null,
          transfer_date: String(f.get("date") || todayAngola()),
          asset_id: String(f.get("asset") || "") || null,
        },
      });
      toast.success("Cedência registada.");
      form.reset();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function onReturn(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await giveBack({
        data: {
          parent_id: id,
          amount: (Math.round(Number(f.get("amount")) * 100) / 100),
          payment_method: String(f.get("method")) as Method,
          transfer_date: String(f.get("date") || todayAngola()),
        },
      });
      toast.success("Devolução registada.");
      setRetFor(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível guardar.");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Apagar este registo? As devoluções ligadas também serão apagadas.")) return;
    try {
      await remove({ data: { id } });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível apagar.");
    }
  }

  const loans = q.data || [];
  const open = loans.filter((l) => l.remaining > 0);
  const receivable: Record<string, number> = {};
  const payable: Record<string, number> = {};
  for (const l of open) {
    receivable[l.from_sector] = (receivable[l.from_sector] || 0) + l.remaining;
    payable[l.to_sector] = (payable[l.to_sector] || 0) + l.remaining;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <PageHeader dot="bg-success" title="Cedências entre Setores" subtitle="Ajudas entre setores que depois são devolvidas" />
      <div className="flex-1 overflow-auto p-6 space-y-5">
        <form onSubmit={onCreate} className="rounded-xl bg-panel ring-1 ring-edge p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Sai de (cede)">
            <select name="from" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} required>{slugs.map((s) => <option key={s} value={s}>{SECTOR_LABELS[s]}</option>)}</select>
            <select name="asset" key={from} className={`${inputClass} mt-1 h-8 text-xs ring-brand/40`} title="Veículo/equipamento que cede">
              <option value="">Caixa do setor</option>
              {fromAssets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Vai para (recebe)">
            <select name="to" className={inputClass} required defaultValue={slugs[1]}>{slugs.map((s) => <option key={s} value={s}>{SECTOR_LABELS[s]}</option>)}</select>
          </Field>
          <Field label="Valor (Kz)">
            <input name="amount" type="number" step="any" min={1} required className={inputClass} />
          </Field>
          <Field label="Pagamento">
            <select name="method" className={inputClass}><option value="Numerário">Numerário</option><option value="Banco">Banco (VB)</option></select>
          </Field>
          <Field label="Data">
            <input name="date" type="date" defaultValue={todayAngola()} className={inputClass} />
          </Field>
          <Field label="Motivo">
            <input name="note" placeholder="Opcional" className={inputClass} />
          </Field>
          <button disabled={saving} className="sm:col-span-3 h-11 rounded-md bg-brand text-primary-foreground font-medium disabled:opacity-50">
            {saving ? "A guardar…" : "Registar cedência"}
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card title="A receber (setor que cedeu)">
            <ul className="divide-y divide-edge/60">
              {Object.keys(receivable).length === 0 ? <li className="p-5 text-sm text-muted-foreground">Nada por receber.</li> : null}
              {Object.entries(receivable).map(([s, v]) => (
                <li key={s} className="flex justify-between px-5 py-3 text-sm"><span>{SECTOR_LABELS[s]}</span><span className="font-display text-success">{formatMoney(v)} Kz</span></li>
              ))}
            </ul>
          </Card>
          <Card title="A pagar (setor que recebeu)">
            <ul className="divide-y divide-edge/60">
              {Object.keys(payable).length === 0 ? <li className="p-5 text-sm text-muted-foreground">Nada por pagar.</li> : null}
              {Object.entries(payable).map(([s, v]) => (
                <li key={s} className="flex justify-between px-5 py-3 text-sm"><span>{SECTOR_LABELS[s]}</span><span className="font-display text-destructive">{formatMoney(v)} Kz</span></li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="Histórico de cedências">
          <ul className="divide-y divide-edge/60">
            {loans.length === 0 ? <li className="p-5 text-sm text-muted-foreground">{q.isLoading ? "A carregar…" : "Ainda sem cedências."}</li> : null}
            {loans.map((l) => (
              <li key={l.id} className="px-5 py-3 text-sm space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{l.transfer_date.split("-").reverse().join("/")}</span>
                    {SECTOR_LABELS[l.from_sector]}{l.asset_id && assetName[l.asset_id] ? ` (${assetName[l.asset_id]})` : ""} <ArrowRight className="size-3.5" /> {SECTOR_LABELS[l.to_sector]}
                    {l.payment_method === "Banco" ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand/15 text-brand">VB</span> : null}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-display">{formatMoney(l.amount)} Kz</span>
                    {l.remaining > 0 ? (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-destructive/15 text-destructive">Falta {formatMoney(l.remaining)}</span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-success/15 text-success">Devolvido</span>
                    )}
                    {l.remaining > 0 ? (
                      <button onClick={() => setRetFor(retFor === l.id ? null : l.id)} className="text-xs px-2 py-1 rounded ring-1 ring-edge hover:bg-muted">Devolver</button>
                    ) : null}
                    <button onClick={() => onDelete(l.id)} aria-label="Apagar" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                  </span>
                </div>
                {l.note ? <p className="text-xs text-muted-foreground">{l.note}</p> : null}
                {l.returns.map((r) => (
                  <p key={r.id} className="text-xs text-muted-foreground flex items-center gap-2">
                    ↳ Devolução de {formatMoney(r.amount)} Kz em {r.transfer_date.split("-").reverse().join("/")}
                    <button onClick={() => onDelete(r.id)} aria-label="Apagar devolução" className="hover:text-destructive"><Trash2 className="size-3" /></button>
                  </p>
                ))}
                {retFor === l.id ? (
                  <form onSubmit={(e) => onReturn(e, l.id)} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                    <input name="amount" type="number" step="any" min={1} max={l.remaining} defaultValue={l.remaining} required className={inputClass} />
                    <select name="method" className={inputClass}><option value="Numerário">Numerário</option><option value="Banco">Banco (VB)</option></select>
                    <input name="date" type="date" defaultValue={todayAngola()} className={inputClass} />
                    <button className="h-10 rounded-md bg-success text-primary-foreground font-medium">Confirmar devolução</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
