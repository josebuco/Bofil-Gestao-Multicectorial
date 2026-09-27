import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Truck, Wrench } from "lucide-react";
import { addSectorEntry, listSectorEntries } from "@/lib/access.functions";
import { createExpense, getExpenses } from "@/lib/expenses.functions";
import { createAsset, createStockUsage, deleteAsset, listAssets, listCategories, listStock } from "@/lib/rental.functions";
import { Package } from "lucide-react";
import { Card, PageHeader, PeriodPicker, formatMoney, inputClass, usePeriod } from "@/components/panel";
import { periodLabel } from "@/lib/period";
import { useAccess } from "@/lib/use-access";
import { sendOrQueue, useQueue } from "@/lib/offline";
import { todayAngola } from "@/lib/tz";

export const Route = createFileRoute("/_authenticated/aluguer")({
  head: () => ({
    meta: [
      { title: "Aluguer de Veículos e Equipamentos — Bofil" },
      { name: "description", content: "Cadastro de veículos e equipamentos com entradas e centro de custos por unidade." },
      { property: "og:title", content: "Aluguer de Veículos e Equipamentos — Bofil" },
      { property: "og:description", content: "Cadastro de veículos e equipamentos com entradas e centro de custos por unidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AluguerPage,
});

const BASE_CATEGORIES = ["Manutenção e Reparação", "Combustível", "Seguro", "Pneus", "Salários", "Impostos", "Outros"];
const label = "text-[11px] uppercase tracking-[0.14em] text-muted-foreground";

function AluguerPage() {
  const { preset, setPreset, custom, setCustom, range } = usePeriod("mes");
  const qc = useQueryClient();
  const access = useAccess();
  const listA = useServerFn(listAssets);
  const listE = useServerFn(listSectorEntries);
  const listX = useServerFn(getExpenses);
  const listC = useServerFn(listCategories);
  const addA = useServerFn(createAsset);
  const delA = useServerFn(deleteAsset);
  const addEntry = useServerFn(addSectorEntry);
  const addExp = useServerFn(createExpense);

  const assets = useQuery({ queryKey: ["rental-assets"], queryFn: () => listA() });
  const entries = useQuery({ queryKey: ["entries", "aluguer", range.from, range.to], queryFn: () => listE({ data: { sector: "aluguer", ...range } }) });
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: () => listX() });
  const cats = useQuery({ queryKey: ["expense-categories"], queryFn: () => listC() });
  const categories = Array.from(new Set([...BASE_CATEGORIES, ...(cats.data || [])]));
  const listStk = useServerFn(listStock);
  const addUse = useServerFn(createStockUsage);
  const stock = useQuery({ queryKey: ["rental-stock"], queryFn: () => listStk() });

  const qUsage = useQueue("stock_usage").map((q) => ({
    id: q.id,
    purchase_id: String(q.data["purchase_id"] || ""),
    asset_id: (q.data["asset_id"] as string) || null,
    quantity: Number(q.data["quantity"]) || 0,
    amount: Number(q.data["amount"]) || 0,
    note: (q.data["note"] as string) || null,
    used_on: String(q.data["used_on"] || q.at.slice(0, 10)),
    pending: true,
  }));
  const allUsage = [...qUsage, ...(stock.data?.usages || []).map((u) => ({ ...u, pending: false }))];
  const stockItems = (stock.data?.items || []).map((i) => {
    const pend = qUsage.filter((u) => u.purchase_id === i.id);
    const pq = pend.reduce((s, u) => s + u.quantity, 0);
    const pa = pend.reduce((s, u) => s + u.amount, 0);
    return { ...i, left_quantity: i.left_quantity - pq, left_amount: i.left_amount - pa };
  });

  const qEntries = useQueue("sector_entry").filter((q) => q.data["sector"] === "aluguer")
    .map((q) => ({ id: q.id, amount: Number(q.data["amount"]) || 0, payment_method: String(q.data["payment_method"]), created_at: q.at, asset_id: (q.data["asset_id"] as string) || null, pending: true }));
  const qExp = useQueue("expense").filter((q) => q.data["sector"] === "aluguer")
    .map((q) => ({ id: q.id, amount: Number(q.data["amount"]) || 0, description: String(q.data["description"] || ""), category: String(q.data["category"] || ""), expense_date: String(q.data["expense_date"] || q.at.slice(0, 10)), status: String(q.data["status"] || "Pendente"), asset_id: (q.data["asset_id"] as string) || null, pending: true }));

  const allEntries = [...qEntries, ...(entries.data || []).map((e) => ({ ...e, pending: false }))];
  const allExp = [
    ...qExp,
    ...(expenses.data?.expenses || []).filter((e) => e.sector === "aluguer").map((e) => ({ ...e, pending: false })),
  ].filter((e) => e.expense_date >= range.from && e.expense_date <= range.to);

  const [selected, setSelected] = useState<string | null>(null);
  const list = assets.data || [];
  const current = list.find((a) => a.id === selected) || list[0];
  const statsFor = (id: string) => {
    const rev = allEntries.filter((e) => e.asset_id === id).reduce((s, e) => s + e.amount, 0);
    const exp = allExp.filter((e) => e.asset_id === id).reduce((s, e) => s + (e.amount || 0), 0);
    return { rev, exp, bal: rev - exp };
  };

  const [showNew, setShowNew] = useState(false);
  async function onNewAsset(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    try {
      await addA({ data: { name: String(f.get("name")), kind: f.get("kind") === "Equipamento" ? "Equipamento" : "Veículo", plate: String(f.get("plate") || "").trim() || null } });
      toast.success("Registado.");
      setShowNew(false);
      await qc.invalidateQueries({ queryKey: ["rental-assets"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao guardar (precisa de internet).");
    }
  }

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"Numerário" | "Banco">("Numerário");
  async function onEntry(ev: React.FormEvent) {
    ev.preventDefault();
    if (!current) return;
    const value = Math.round(Number(amount));
    if (!value || value <= 0) { toast.error("Indique um valor válido."); return; }
    const payload = { sector: "aluguer" as const, amount: value, payment_method: method, asset_id: current.id };
    try {
      const r = await sendOrQueue("sector_entry", payload, `Aluguer ${current.name}: ${formatMoney(value)} Kz`, () => addEntry({ data: payload }));
      setAmount("");
      toast.success(r === "queued" ? "Sem internet: guardado no aparelho." : "Entrada registada.");
      if (r === "sent") await Promise.all([qc.invalidateQueries({ queryKey: ["entries", "aluguer"] }), qc.invalidateQueries({ queryKey: ["finance"] })]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar.");
    }
  }

  async function onExpense(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!current) return;
    const f = new FormData(ev.currentTarget);
    const form = ev.currentTarget;
    const payload = {
      sector: "aluguer",
      category: String(f.get("category") || "Outros"),
      description: String(f.get("description") || ""),
      amount: Number(f.get("amount") || 0),
      expense_date: todayAngola(),
      supplier: null,
      status: String(f.get("status") || "Pendente"),
      invoice_path: null,
      notes: null,
      payment_method: (f.get("payment_method") === "Banco" ? "Banco" : "Numerário") as "Banco" | "Numerário",
      asset_id: current.id,
    };
    try {
      const r = await sendOrQueue("expense", payload, `Despesa ${current.name}: ${payload.description}`, () => addExp({ data: payload }));
      form.reset();
      toast.success(r === "queued" ? "Sem internet: despesa guardada no aparelho." : "Despesa registada.");
      if (r === "sent") await Promise.all([qc.invalidateQueries({ queryKey: ["expenses"] }), qc.invalidateQueries({ queryKey: ["finance"] })]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar.");
    }
  }

  const curEntries = current ? allEntries.filter((e) => e.asset_id === current.id) : [];
  const curExp = current ? allExp.filter((e) => e.asset_id === current.id) : [];
  const badge = <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning">No aparelho</span>;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <PageHeader
        dot="bg-primary"
        title="Aluguer de Veículos e Equipamentos"
        subtitle="Cada unidade com as suas entradas e o seu centro de custos"
        action={<PeriodPicker preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />}
      />
      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">{periodLabel(preset, range)}</p>
          <button onClick={() => setShowNew((v) => !v)} className="h-10 px-4 rounded-md bg-brand text-primary-foreground text-sm font-medium flex items-center gap-2">
            <Plus className="size-4" /> Cadastrar veículo / equipamento
          </button>
        </div>

        {showNew && (
          <form onSubmit={onNewAsset} className="rounded-xl bg-panel ring-1 ring-edge p-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2"><label className={label}>Nome</label><input name="name" required placeholder="Ex.: Toyota Hilux, Gerador 50kVA" className={`${inputClass} mt-1.5`} /></div>
            <div><label className={label}>Tipo</label><select name="kind" className={`${inputClass} mt-1.5`}><option>Veículo</option><option>Equipamento</option></select></div>
            <div><label className={label}>Matrícula / Nº série</label><input name="plate" className={`${inputClass} mt-1.5`} /></div>
            <button className="md:col-span-4 h-11 rounded-md bg-primary text-primary-foreground font-medium">Guardar</button>
          </form>
        )}

        {list.length === 0 ? (
          <p className="rounded-xl bg-panel ring-1 ring-edge p-6 text-sm text-muted-foreground">Ainda não há veículos ou equipamentos cadastrados.</p>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {list.map((a) => {
              const s = statsFor(a.id);
              const active = current?.id === a.id;
              const Icon = a.kind === "Equipamento" ? Wrench : Truck;
              return (
                <button key={a.id} onClick={() => setSelected(a.id)} className={`text-left rounded-xl p-4 ring-1 transition-colors ${active ? "bg-primary/10 ring-primary" : "bg-panel ring-edge hover:bg-white/5"}`}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    <p className="font-display uppercase tracking-wide text-foreground truncate">{a.name}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{a.kind}{a.plate ? ` · ${a.plate}` : ""}</p>
                  <div className={`mt-3 grid gap-2 text-xs ${access.isAdmin ? "grid-cols-3" : "grid-cols-1"}`}>
                    <div><p className="text-muted-foreground">Entradas</p><p className="font-display text-warning">{formatMoney(s.rev)}</p></div>
                    {access.isAdmin && <>
                    <div><p className="text-muted-foreground">Custos</p><p className="font-display text-destructive">{formatMoney(s.exp)}</p></div>
                    <div><p className="text-muted-foreground">Saldo</p><p className={`font-display ${s.bal >= 0 ? "text-success" : "text-destructive"}`}>{formatMoney(s.bal)}</p></div>
                    </>}
                  </div>
                </button>
              );
            })}
          </section>
        )}

        {current && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg uppercase tracking-wide text-foreground">{current.name}</h2>
              {access.isAdmin && (
                <button
                  onClick={async () => {
                    if (!confirm(`Apagar ${current.name}? Os registos ficam no setor sem unidade.`)) return;
                    try { await delA({ data: { id: current.id } }); setSelected(null); await qc.invalidateQueries({ queryKey: ["rental-assets"] }); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                ><Trash2 className="size-3.5" /> Apagar unidade</button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card title="Entradas">
                <form onSubmit={onEntry} className="p-4 flex gap-2 items-end border-b border-edge">
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={1} placeholder="Valor (Kz)" className={`${inputClass} flex-1`} />
                  <select value={method} onChange={(e) => setMethod(e.target.value as "Numerário" | "Banco")} className={`${inputClass} w-36`}>
                    <option value="Numerário">Numerário</option><option value="Banco">Banco (VB)</option>
                  </select>
                  <button className="h-10 px-4 rounded-md bg-warning text-primary-foreground font-medium"><Plus className="size-4" /></button>
                </form>
                <ul className="divide-y divide-edge/60 max-h-80 overflow-auto">
                  {curEntries.length === 0 && <li className="p-5 text-sm text-muted-foreground">Sem entradas neste período.</li>}
                  {curEntries.map((e) => (
                    <li key={e.id} className="flex justify-between px-5 py-3 text-sm">
                      <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-AO")}{e.payment_method === "Banco" ? " · VB" : ""}{e.pending ? badge : null}</span>
                      <span className="font-display text-warning">+{formatMoney(e.amount)}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="Centro de custos">
                <form onSubmit={onExpense} className="p-4 grid grid-cols-2 gap-2 border-b border-edge">
                  <input name="description" required placeholder="Descrição" className={`${inputClass} col-span-2`} />
                  <input name="amount" type="number" min={1} required placeholder="Valor (Kz)" className={inputClass} />
                  <select name="category" className={inputClass}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
                  <select name="payment_method" className={inputClass}><option value="Numerário">Numerário</option><option value="Banco">Banco (VB)</option></select>
                  <select name="status" className={inputClass}><option>Pendente</option><option>Pago</option></select>
                  <button className="col-span-2 h-10 rounded-md bg-destructive text-primary-foreground font-medium">Registar despesa</button>
                </form>
                <ul className="divide-y divide-edge/60 max-h-80 overflow-auto">
                  {curExp.length === 0 && <li className="p-5 text-sm text-muted-foreground">Sem despesas neste período.</li>}
                  {curExp.map((e) => (
                    <li key={e.id} className="flex justify-between px-5 py-3 text-sm gap-3">
                      <span className="text-muted-foreground min-w-0 truncate">{e.expense_date} · {e.description} <span className="text-[11px]">({e.category}, {e.status})</span>{e.pending ? badge : null}</span>
                      <span className="font-display text-destructive shrink-0">−{formatMoney(e.amount || 0)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
