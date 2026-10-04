import { FleetPage } from "@/components/fleet-page";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, CalendarDays, FileText, Plus, Trash2 } from "lucide-react";
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addSectorEntry, deleteSectorEntry, listSectorEntries } from "@/lib/access.functions";
import { createExpense, deleteExpense } from "@/lib/expenses.functions";
import { addCategory, listCategories } from "@/lib/rental.functions";
import { openInvoice, uploadInvoice } from "@/lib/invoice";
import { getFinance } from "@/lib/finance.functions";
import { periodLabel } from "@/lib/period";
import { Card, CashBalanceCard, ExpandableCard, PageHeader, PeriodPicker, formatMoney, inputClass, usePeriod } from "@/components/panel";
import { chartTooltip } from "@/components/sector-cash";
import { DebtCard } from "@/components/debt-card";
import { useAccess } from "@/lib/use-access";
import { sendOrQueue, useQueue } from "@/lib/offline";
import { useMergedFinance } from "@/lib/offline-finance";
import { todayAngola } from "@/lib/tz";
import { Button } from "@/components/ui/button";

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
  const isAdminView = access.isAdmin;
  const [amount, setAmount] = useState("");
  const [cost, setCost] = useState("");
  const [method, setMethod] = useState<"Numerário" | "Banco">("Numerário");
  const [saving, setSaving] = useState(false);
  const addExp = useServerFn(createExpense);
  const delExp = useServerFn(deleteExpense);
  const addCat = useServerFn(addCategory);
  const extraCats = useQuery({ queryKey: ["expense-categories"], queryFn: () => listCategories() });
  const categories = Array.from(new Set(["Combustível", "Manutenção e Reparação", "Produtos", "Subsídio de Alimentação", "Salários", "Energia", ...(extraCats.data || []), "Outros"]));
  async function onNewCategory() {
    const name = window.prompt("Nome da nova categoria de custo:")?.trim();
    if (!name) return;
    try {
      await addCat({ data: { name } });
      await qc.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success(`Categoria "${name}" criada.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar (precisa de internet).");
    }
  }
  async function onExpense(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const value = Math.round(Number(f.get("amount")));
    if (!value || value <= 0) { toast.error("Indique um valor válido."); return; }
    let invoicePath: string | null = null;
    try { invoicePath = await uploadInvoice(f.get("invoice") as File | null, slug); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao enviar comprovativo."); return; }
    const payload = {
      sector: slug,
      category: String(f.get("category") || "Geral").trim() || "Geral",
      description: String(f.get("description") || "").trim() || "Despesa",
      amount: value,
      expense_date: isAdminView && entryDate ? entryDate : todayAngola(),
      supplier: String(f.get("supplier") || "").trim() || null,
      status: String(f.get("status") || "Pago"),
      invoice_path: invoicePath,
      notes: null,
      payment_method: (f.get("payment_method") === "Banco" ? "Banco" : "Numerário") as "Banco" | "Numerário",
      asset_id: null,
    };
    try {
      const r = await sendOrQueue("expense", payload, `Despesa ${title}: ${payload.description}`, () => addExp({ data: payload }));
      form.reset();
      toast.success(r === "queued" ? "Sem internet: despesa guardada no aparelho." : "Saída registada.");
      if (r === "sent") await Promise.all([qc.invalidateQueries({ queryKey: ["finance"] }), qc.invalidateQueries({ queryKey: ["expenses"] })]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível guardar.");
    }
  }
  const [entryDate, setEntryDate] = useState("");
  const [showEntryDate, setShowEntryDate] = useState(false);

  const finance = useQuery({
    queryKey: ["finance", range.from, range.to],
    queryFn: () => getFinance({ data: range }),
  });
  const entries = useQuery({
    queryKey: ["entries", slug, range.from, range.to],
    queryFn: () => list({ data: { sector: slug, ...range } }),
  });

  const queued = useQueue("sector_entry")
    .filter((q) => q.data["sector"] === slug)
    .map((q) => ({ id: q.id, amount: Number(q.data["amount"]) || 0, cost: Number(q.data["cost"]) || 0, payment_method: String(q.data["payment_method"]), created_at: q.at, pending: true }));
  const allEntries = [...queued, ...(entries.data || []).map((e) => ({ ...e, cost: e.cost || 0, pending: false }))];
  const entTotal = allEntries.reduce((s, e) => s + e.amount, 0);
  const costTotal = allEntries.reduce((s, e) => s + e.cost, 0);
  const mergedFinance = useMergedFinance(finance.data, range);
  const sector = mergedFinance.sectors.find((s) => s.slug === slug);
  const outs = mergedFinance.entries.filter((e) => e.sector === slug && e.kind === "despesa");
  const outsTotal = outs.reduce((s, e) => s + (Number(e.amount) || 0), 0);

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
      const c = Math.max(0, Math.round(Number(cost) || 0));
      if (c > value) { toast.error("O custo não pode ser maior que a entrada."); setSaving(false); return; }
      const payload = { sector: slug, amount: value, cost: c, payment_method: method, ...(isAdminView && entryDate ? { entry_date: entryDate } : {}) };
      const r = await sendOrQueue("sector_entry", payload, `${title}: ${formatMoney(value)} Kz`, () => add({ data: payload }));
      setAmount("");
      setCost("");
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

  const totalsBlock = (
      <>
        <p className="text-[11px] text-muted-foreground">{periodLabel(preset, range)}</p>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
          <CashBalanceCard total={balance} cash={sector?.cash || 0} bank={sector?.bank || 0} />
        </section>

        <DebtCard sector={slug} />

        <Card title="Custo e Lucro">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-5">
            <div><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Entradas</p><p className="font-display text-2xl text-warning">{formatMoney(entTotal)}</p></div>
            <div><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Custo total</p><p className="font-display text-2xl text-foreground">{formatMoney(costTotal)}</p></div>
            <div><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Saídas</p><p className="font-display text-2xl text-destructive">{formatMoney(outsTotal)}</p></div>
            <div><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Lucro líquido</p><p className="font-display text-2xl text-success">{formatMoney(entTotal - costTotal - outsTotal)}</p></div>
            <p className="sm:col-span-4 text-[11px] text-muted-foreground">Entradas {formatMoney(entTotal)} − Custos {formatMoney(costTotal)} − Saídas {formatMoney(outsTotal)} = Lucro {formatMoney(entTotal - costTotal - outsTotal)}</p>
          </div>
        </Card>

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

      </>
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <PageHeader
        dot={dot}
        title={title}
        subtitle="Entradas e saídas com saldo automático"
        action={<PeriodPicker preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />}
      />
      <div className="flex-1 overflow-auto p-6 space-y-5">
        <ExpandableCard title="Registar entrada" summary="Adicionar uma nova entrada neste setor">
        <form
          onSubmit={onSubmit}
          className="relative p-4 pt-14 flex flex-col xl:flex-row gap-2 xl:items-end"
        >
          {isAdminView ? (
            <div className="absolute right-5 top-4 flex items-center gap-2">
              {showEntryDate ? (
                <input
                  type="date"
                  value={entryDate}
                  max={todayAngola()}
                  onChange={(e) => setEntryDate(e.target.value)}
                  aria-label="Data da entrada"
                  className="h-8 w-36 rounded-md bg-ink ring-1 ring-edge px-2 text-xs text-foreground focus:outline-none focus:ring-primary"
                />
              ) : null}
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setShowEntryDate((open) => !open);
                  if (!entryDate) setEntryDate(todayAngola());
                }}
                aria-expanded={showEntryDate}
              >
                <CalendarDays /> Data
              </Button>
            </div>
          ) : null}
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
              className={`${inputClass} mt-1.5 text-xl font-display h-12`}
            />
            {!isAdminView ? (
              <p className="text-[11px] text-muted-foreground mt-1.5">Data e hora são registadas automaticamente.</p>
            ) : null}
          </div>
          <div className="xl:w-44">
            <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Custo da entrada (Kz)</label>
            <input
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              className={`${inputClass} mt-1.5 text-xl font-display h-12`}
            />
            <p className="text-[11px] text-success mt-1.5">Lucro: {formatMoney((Number(amount) || 0) - (Number(cost) || 0))}</p>
          </div>
          <div className="grid grid-cols-2 w-full xl:w-64 shrink-0 rounded-md ring-1 ring-edge overflow-hidden h-12">
            {(["Numerário", "Banco"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`min-w-0 whitespace-nowrap px-2 text-sm font-medium ${method === m ? "bg-brand text-primary-foreground" : "text-muted-foreground hover:bg-white/5"}`}
              >
                {m === "Banco" ? "Banco (VB)" : m}
              </button>
            ))}
          </div>
          <button
            disabled={saving}
            className={`h-12 px-5 w-full xl:w-auto shrink-0 rounded-md font-medium text-primary-foreground ${accent} hover:opacity-90 disabled:opacity-50 flex items-center gap-2 justify-center whitespace-nowrap`}
          >
            <Plus className="size-5" /> {saving ? "A guardar…" : "Registar entrada"}
          </button>
        </form>
        </ExpandableCard>

        {totalsBlock}
        {slug === "lavagem" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ExpandableCard title="Registar saída" summary="Adicionar uma despesa geral da Lavagem">
            <form onSubmit={onExpense} className="p-4 grid grid-cols-2 gap-2 border-b border-edge">
              <input name="description" required placeholder="Descrição" className={`${inputClass} col-span-2`} />
              <input name="amount" type="number" min={1} required inputMode="numeric" placeholder="Valor (Kz)" className={`${inputClass} h-12 text-lg font-display col-span-2`} />
              <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input name="category" list={`cats-${slug}`} placeholder="Categoria" className={inputClass} />
                <datalist id={`cats-${slug}`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
                <button type="button" onClick={onNewCategory} className="h-10 px-3 rounded-md ring-1 ring-edge bg-panel text-sm font-medium text-primary hover:bg-primary/10 whitespace-nowrap">
                  <Plus className="size-4 inline-block mr-1" /> Nova categoria
                </button>
              </div>
              <input name="supplier" placeholder="Fornecedor (opcional)" className={inputClass} />
              <select name="payment_method" className={inputClass}><option value="Numerário">Numerário</option><option value="Banco">Banco (VB)</option></select>
              <select name="status" className={inputClass}><option>Pago</option><option>Pendente</option></select>
              <label className="col-span-2 text-[11px] text-muted-foreground">Comprovativo (foto ou PDF, opcional)
                <input name="invoice" type="file" accept="image/*,application/pdf" className="mt-1 block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-edge file:px-2 file:py-1 file:text-foreground" />
              </label>
              <button className="col-span-2 h-11 rounded-md bg-destructive text-primary-foreground font-medium">Registar saída</button>
            </form>
          </ExpandableCard>
          <ExpandableCard title="Todas as saídas" summary={`${outs.length} registo${outs.length === 1 ? "" : "s"} no período`}>
            <ul className="divide-y divide-edge/60 max-h-96 overflow-auto">
              {outs.length === 0 ? (
                <li className="p-5 text-sm text-muted-foreground">Sem saídas neste período.</li>
              ) : null}
              {outs.map((e, i) => (
                <li key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-muted-foreground">
                    {e.date.slice(0, 10)}
                    {e.pending ? <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning">No aparelho</span> : null}
                  </span>
                  <span className="flex items-center gap-3">
                    {e.invoice_path && !e.pending ? (
                      <button type="button" onClick={() => e.invoice_path && void openInvoice(e.invoice_path)} className="text-xs text-primary flex items-center gap-1"><FileText className="size-3.5" /> Ver fatura</button>
                    ) : null}
                    <span className="font-display text-destructive">−{formatMoney(e.amount)}</span>
                    {access.isAdmin && !e.pending ? (
                      <button
                        type="button"
                        aria-label="Apagar saída"
                        onClick={async () => {
                          if (!window.confirm("Apagar esta saída?")) return;
                          try {
                            await delExp({ data: { id: e.id } });
                            toast.success("Saída apagada.");
                            await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ["expenses"] })]);
                          } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível apagar."); }
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      ><Trash2 className="size-4" /></button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </ExpandableCard>
          </div>
        )}
        {slug === "lavagem" && (
          <section className="space-y-3">
            <h2 className="font-display text-lg uppercase tracking-wide text-foreground">Equipamentos</h2>
            <FleetPage sector="lavagem" title="Lavagem" subtitle="" dot="bg-wash" embedded />
          </section>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ExpandableCard title="Todas as entradas" summary={`${allEntries.length} registo${allEntries.length === 1 ? "" : "s"} no período`}>
            <ul className="divide-y divide-edge/60 max-h-96 overflow-auto">
              {allEntries.length === 0 ? (
                <li className="p-5 text-sm text-muted-foreground">Sem entradas neste período.</li>
              ) : null}
              {allEntries.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-AO")}
                    {e.payment_method === "Banco" ? <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand/15 text-brand">VB</span> : null}
                    {e.pending ? <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning">No aparelho</span> : null}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-right">
                      <span className="font-display text-warning">+{formatMoney(e.amount)}</span>
                      <span className="block text-[10px] text-muted-foreground">Custo {formatMoney(e.cost)} · Lucro {formatMoney(e.amount - e.cost)}</span>
                    </span>
                    {access.isAdmin && !e.pending ? (
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
          </ExpandableCard>
          {slug !== "lavagem" && (
          <div className="space-y-3">
          <ExpandableCard title="Registar saída" summary="Adicionar uma despesa geral do setor">
            <form onSubmit={onExpense} className="p-4 grid grid-cols-2 gap-2 border-b border-edge">
              <input name="description" required placeholder="Descrição" className={`${inputClass} col-span-2`} />
              <input name="amount" type="number" min={1} required inputMode="numeric" placeholder="Valor (Kz)" className={`${inputClass} h-12 text-lg font-display col-span-2`} />
              <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input name="category" list={`cats-${slug}`} placeholder="Categoria" className={inputClass} />
                <datalist id={`cats-${slug}`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
                <button type="button" onClick={onNewCategory} className="h-10 px-3 rounded-md ring-1 ring-edge bg-panel text-sm font-medium text-primary hover:bg-primary/10 whitespace-nowrap">
                  <Plus className="size-4 inline-block mr-1" /> Nova categoria
                </button>
              </div>
              <input name="supplier" placeholder="Fornecedor (opcional)" className={inputClass} />
              <select name="payment_method" className={inputClass}><option value="Numerário">Numerário</option><option value="Banco">Banco (VB)</option></select>
              <select name="status" className={inputClass}><option>Pago</option><option>Pendente</option></select>
              <label className="col-span-2 text-[11px] text-muted-foreground">Comprovativo (foto ou PDF, opcional)
                <input name="invoice" type="file" accept="image/*,application/pdf" className="mt-1 block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-edge file:px-2 file:py-1 file:text-foreground" />
              </label>
              <button className="col-span-2 h-11 rounded-md bg-destructive text-primary-foreground font-medium">Registar saída</button>
            </form>
          </ExpandableCard>
          <ExpandableCard title="Todas as saídas" summary={`${outs.length} registo${outs.length === 1 ? "" : "s"} no período`}>
            <ul className="divide-y divide-edge/60 max-h-96 overflow-auto">
              {outs.length === 0 ? (
                <li className="p-5 text-sm text-muted-foreground">Sem saídas neste período.</li>
              ) : null}
              {outs.map((e, i) => (
                <li key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-muted-foreground">
                    {e.date.slice(0, 10)}
                    {e.pending ? <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning">No aparelho</span> : null}
                  </span>
                  <span className="flex items-center gap-3">
                    {e.invoice_path && !e.pending ? (
                      <button type="button" onClick={() => e.invoice_path && void openInvoice(e.invoice_path)} className="text-xs text-primary flex items-center gap-1"><FileText className="size-3.5" /> Ver fatura</button>
                    ) : null}
                    <span className="font-display text-destructive">−{formatMoney(e.amount)}</span>
                    {access.isAdmin && !e.pending ? (
                      <button
                        type="button"
                        aria-label="Apagar saída"
                        onClick={async () => {
                          if (!window.confirm("Apagar esta saída?")) return;
                          try {
                            await delExp({ data: { id: e.id } });
                            toast.success("Saída apagada.");
                            await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ["expenses"] })]);
                          } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível apagar."); }
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      ><Trash2 className="size-4" /></button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </ExpandableCard>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
