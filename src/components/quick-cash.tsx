import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Plus, Trash2, Wallet } from "lucide-react";
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addSectorEntry, deleteSectorEntry, listSectorEntries } from "@/lib/access.functions";
import { getFinance } from "@/lib/finance.functions";
import { periodLabel } from "@/lib/period";
import { Card, PageHeader, PeriodPicker, formatMoney, inputClass, usePeriod } from "@/components/panel";
import { chartTooltip } from "@/components/sector-cash";
import { useAccess } from "@/lib/use-access";
import { sendOrQueue } from "@/lib/offline";

type Slug = "restaurante" | "lavagem" | "transporte";

export function QuickCashPage({
  slug,
  title,
  dot,
  accent,
}: {
  slug: Slug;
  title: string;
  dot: string;
  accent: string;
}) {
  const { preset, setPreset, custom, setCustom, range } = usePeriod("mes");
  const qc = useQueryClient();
  const add = useServerFn(addSectorEntry);
  const remove = useServerFn(deleteSectorEntry);
  const list = useServerFn(listSectorEntries);
  const access = useAccess();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"Numerário" | "Banco">("Numerário");
  const [saving, setSaving] = useState(false);

  const finance = useQuery({
    queryKey: ["finance", range.from, range.to],
    queryFn: () => getFinance({ data: range }),
  });
  const entries = useQuery({
    queryKey: ["entries", slug, range.from, range.to],
    queryFn: () => list({ data: { sector: slug, ...range } }),
  });

  const sector = finance.data?.sectors.find((s) => s.slug === slug);
  const outs = (finance.data?.entries || []).filter((e) => e.sector === slug && e.kind === "despesa");

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["finance"] }),
      qc.invalidateQueries({ queryKey: ["entries", slug] }),
    ]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Math.round(Number(amount));
    if (!value || value <= 0) { toast.error("Indique um valor válido."); return; }
    setSaving(true);
    try {
      const payload = { sector: slug, amount: value, payment_method: method };
      const r = await sendOrQueue("sector_entry", payload, `${title}: ${formatMoney(value)} Kz`, () => add({ data: payload }));
      setAmount("");
      if (r === "queued") toast.success(`Sem internet: ${formatMoney(value)} Kz guardado no aparelho. Envia ao sincronizar.`);
      else {
        toast.success(`Entrada de ${formatMoney(value)} Kz registada.`);
        await refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  const balance = sector?.balance || 0;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <PageHeader
        dot={dot}
        title={title}
        subtitle="Entradas e saídas com saldo automático"
        action={<PeriodPicker preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />}
      />
      <div className="flex-1 overflow-auto p-6 space-y-5">
        <form
          onSubmit={onSubmit}
          className="rounded-xl bg-panel ring-1 ring-edge p-5 flex flex-col sm:flex-row gap-3 sm:items-end"
        >
          <div className="flex-1">
            <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Nova entrada (Kz)
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="0"
              className={`${inputClass} mt-1.5 text-2xl font-display h-14`}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">Data e hora são registadas automaticamente.</p>
          </div>
          <div className="flex rounded-md ring-1 ring-edge overflow-hidden h-14">
            {(["Numerário", "Banco"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`px-4 text-sm font-medium ${method === m ? "bg-brand text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}
              >
                {m === "Banco" ? "Banco (VB)" : m}
              </button>
            ))}
          </div>
          <button
            disabled={saving}
            className={`h-14 px-6 rounded-md font-medium text-primary-foreground ${accent} hover:opacity-90 disabled:opacity-50 flex items-center gap-2 justify-center`}
          >
            <Plus className="size-5" /> {saving ? "A guardar…" : "Registar entrada"}
          </button>
        </form>

        <p className="text-[11px] text-muted-foreground">{periodLabel(preset, range)}</p>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-panel ring-1 ring-edge p-5">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-[0.14em]">
              Entradas <ArrowUpRight className="size-4 text-warning" />
            </div>
            <p className="mt-2 font-display text-3xl text-warning">{formatMoney(sector?.revenue || 0)}</p>
          </div>
          <div className="rounded-xl bg-panel ring-1 ring-edge p-5">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-[0.14em]">
              Saídas (Centro de Custos) <ArrowDownRight className="size-4 text-destructive" />
            </div>
            <p className="mt-2 font-display text-3xl text-destructive">{formatMoney(sector?.expense || 0)}</p>
          </div>
          <div
             className={`rounded-xl p-5 ring-1 ${balance >= 0 ? "bg-success/10 ring-success/40" : "bg-destructive/10 ring-destructive/40"}`}
          >
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-[0.14em]">
              Saldo <Wallet className="size-4" />
            </div>
             <p className={`mt-2 font-display text-4xl ${balance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatMoney(balance)}
            </p>
          </div>
        </section>

        <Card title="Evolução">
          <div className="h-60 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={sector?.series || []}>
                <defs>
                  <linearGradient id={`q-in-${slug}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--warning)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id={`q-out-${slug}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} width={70} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={chartTooltip} />
                <Area type="monotone" dataKey="receitas" name="Entradas" stroke="var(--warning)" strokeWidth={2} fill={`url(#q-in-${slug})`} />
                <Area type="monotone" dataKey="despesas" name="Saídas" stroke="var(--destructive)" strokeWidth={2} fill={`url(#q-out-${slug})`} />
                <Line type="monotone" dataKey="saldo" name="Saldo" stroke="var(--success)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card title="Entradas">
            <ul className="divide-y divide-edge/60 max-h-96 overflow-auto">
              {(entries.data || []).length === 0 ? (
                <li className="p-5 text-sm text-muted-foreground">Sem entradas neste período.</li>
              ) : null}
              {(entries.data || []).map((e) => (
                <li key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-AO")}
                    {e.payment_method === "Banco" ? <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand/15 text-brand">VB</span> : null}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-display text-warning">+{formatMoney(e.amount)}</span>
                    {access.isAdmin ? (
                      <button
                        aria-label="Apagar entrada"
                        onClick={async () => {
                          await remove({ data: { id: e.id } });
                          toast.success("Entrada apagada.");
                          await refresh();
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Saídas (do Centro de Custos)">
            <ul className="divide-y divide-edge/60 max-h-96 overflow-auto">
              {outs.length === 0 ? (
                <li className="p-5 text-sm text-muted-foreground">Sem saídas neste período.</li>
              ) : null}
              {outs.map((e, i) => (
                <li key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-muted-foreground">{e.date.slice(0, 10)}</span>
                  <span className="font-display text-destructive">−{formatMoney(e.amount)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
