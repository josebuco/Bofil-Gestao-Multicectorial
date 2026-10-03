import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Plus, Trash2, Truck, Wrench, Package, Fuel } from "lucide-react";
import { addSectorEntry, deleteSectorEntry, listSectorEntries } from "@/lib/access.functions";
import { createExpense, getExpenses } from "@/lib/expenses.functions";
import { addCategory, createAsset, createStockUsage, deleteAsset, listAssets, listCategories, listStock, listAssetContributions, type FleetSector } from "@/lib/rental.functions";
import { Card, CashBalanceCard, PageHeader, PeriodPicker, formatMoney, inputClass, usePeriod } from "@/components/panel";
import { DebtCard } from "@/components/debt-card";
import { periodLabel } from "@/lib/period";
import { useAccess } from "@/lib/use-access";
import { readQueue, sendOrQueue, useQueue, writeQueue } from "@/lib/offline";
import { todayAngola } from "@/lib/tz";
import { getFinance } from "@/lib/finance.functions";
import { useMergedFinance } from "@/lib/offline-finance";
import { chartTooltip } from "@/components/sector-cash";
import { createWaterSale, listTruckSales, updateWaterSaleStatus, deleteRecord } from "@/lib/crud.functions";
import { getWaterData } from "@/lib/sectors.functions";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const BASE_CATEGORIES = ["Manutenção e Reparação", "Combustível", "Seguro", "Pneus", "Salários", "Impostos", "Outros"];
const label = "text-[11px] uppercase tracking-[0.14em] text-muted-foreground";

export function FleetPage({ sector, title, subtitle, dot, embedded = false, afterAssets }: { sector: FleetSector; title: string; subtitle: string; dot: string; embedded?: boolean; afterAssets?: React.ReactNode }) {
  const perStudentMode = sector === "transporte";
  const sectorEntryMode = false; // entradas sempre por veículo (no Transporte: alunos × valor diário)
  const equipmentOnly = sector === "lavagem";
  const { preset, setPreset, custom, setCustom, range } = usePeriod("mes");
  const qc = useQueryClient();
  const access = useAccess();
  const listA = useServerFn(listAssets);
  const listE = useServerFn(listSectorEntries);
  const listX = useServerFn(getExpenses);
  const listC = useServerFn(listCategories);
  const addA = useServerFn(createAsset);
  const addC = useServerFn(addCategory);
  const delA = useServerFn(deleteAsset);
  const addEntry = useServerFn(addSectorEntry);
  const addExp = useServerFn(createExpense);

  const assets = useQuery({ queryKey: ["rental-assets", sector], queryFn: () => listA({ data: { sector } }) });
  const entries = useQuery({ queryKey: ["entries", sector, range.from, range.to], queryFn: () => listE({ data: { sector, ...range } }) });
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: () => listX() });
  const cats = useQuery({ queryKey: ["expense-categories"], queryFn: () => listC() });
  const categories = Array.from(new Set([...BASE_CATEGORIES, ...(cats.data || [])]));
  const listStk = useServerFn(listStock);
  const addUse = useServerFn(createStockUsage);
  const stock = useQuery({ queryKey: ["rental-stock", sector], queryFn: () => listStk({ data: { sector } }) });

  const qUsageAll = useQueue("stock_usage").map((q) => ({
    id: q.id,
    purchase_id: String(q.data["purchase_id"] || ""),
    asset_id: (q.data["asset_id"] as string) || null,
    quantity: Number(q.data["quantity"]) || 0,
    amount: Number(q.data["amount"]) || 0,
    note: (q.data["note"] as string) || null,
    used_on: String(q.data["used_on"] || q.at.slice(0, 10)),
    sector: String(q.data["sector"] || "aluguer"),
    pending: true,
  }));
  const qUsage = qUsageAll.filter((u) => u.sector === sector);
  const allUsage = [...qUsage, ...(stock.data?.usages || []).map((u) => ({ ...u, pending: false }))];
  const stockItems = (stock.data?.items || []).map((i) => {
    const pend = qUsageAll.filter((u) => u.purchase_id === i.id);
    const pq = pend.reduce((s, u) => s + u.quantity, 0);
    const pa = pend.reduce((s, u) => s + u.amount, 0);
    return { ...i, left_quantity: i.left_quantity - pq, left_amount: i.left_amount - pa };
  });

  const qEntries = useQueue("sector_entry").filter((q) => q.data["sector"] === sector)
    .map((q) => ({ id: q.id, amount: Number(q.data["amount"]) || 0, payment_method: String(q.data["payment_method"]), created_at: q.at, asset_id: (q.data["asset_id"] as string) || null, students: (q.data["students"] as number) ?? null, per_student: (q.data["per_student"] as number) ?? null, pending: true }));
  const qExp = useQueue("expense").filter((q) => q.data["sector"] === sector)
    .map((q) => ({ id: q.id, amount: Number(q.data["amount"]) || 0, description: String(q.data["description"] || ""), category: String(q.data["category"] || ""), expense_date: String(q.data["expense_date"] || q.at.slice(0, 10)), status: String(q.data["status"] || "Pendente"), asset_id: (q.data["asset_id"] as string) || null, pending: true }));

  const allEntries = [...qEntries, ...(entries.data || []).map((e) => ({ ...e, pending: false }))];
  const allExp = [
    ...qExp,
    ...(expenses.data?.expenses || []).filter((e) => e.sector === sector).map((e) => ({ ...e, pending: false })),
  ].filter((e) => e.expense_date >= range.from && e.expense_date <= range.to);

  const truckMode = sector === "agua";
  const listTS = useServerFn(listTruckSales);
  const addTS = useServerFn(createWaterSale);
  const setTS = useServerFn(updateWaterSaleStatus);
  const delRec = useServerFn(deleteRecord);
  const getW = useServerFn(getWaterData);
  const truckSales = useQuery({ queryKey: ["truck-sales", range.from, range.to], queryFn: () => listTS({ data: range }), enabled: truckMode });
  const waterData = useQuery({ queryKey: ["sector", "agua"], queryFn: () => getW(), enabled: truckMode });
  const qTruck = useQueue("water_sale").filter((q) => q.data["asset_id"]).map((q) => ({
    id: q.id, asset_id: String(q.data["asset_id"]), description: String(q.data["description"] || "Serviço"),
    quantity: Number(q.data["quantity"]) || 0, unit_price: Number(q.data["unit_price"]) || 0,
    total: Number(q.data["offline_total"]) || 0, client_name: (q.data["client_name"] as string) || null,
    status: String(q.data["status"] || "Entregue"), payment_method: String(q.data["payment_method"] || "Numerário"), created_at: q.at, pending: true,
  }));
  const allTruck = [...qTruck, ...(truckSales.data || []).map((t) => ({ ...t, asset_id: String(t.asset_id), description: t.description || "Serviço", pending: false }))];

  const [selected, setSelected] = useState<string | null>(null);
  const list = assets.data || [];
  const current = list.find((a) => a.id === selected) || list[0];
  const listCtb = useServerFn(listAssetContributions);
  const contribQ = useQuery({ queryKey: ["asset-contribs", sector], queryFn: () => listCtb({ data: { sector } }) });
  const allContrib = (contribQ.data || []).filter((c) => c.transfer_date >= range.from && c.transfer_date <= range.to);
  const statsFor = (id: string) => {
    const rev = allEntries.filter((e) => e.asset_id === id).reduce((s, e) => s + e.amount, 0)
      + allTruck.filter((t) => t.asset_id === id && t.status !== "Pendente").reduce((s, t) => s + t.total, 0);
    const exp = allExp.filter((e) => e.asset_id === id).reduce((s, e) => s + (e.amount || 0), 0)
      + allContrib.filter((c) => c.asset_id === id).reduce((s, c) => s + (c.amount || 0), 0);
    const used = allUsage.filter((u) => u.asset_id === id && u.used_on >= range.from && u.used_on <= range.to);
    const stk = used.reduce((s, u) => s + (u.amount || 0), 0);
    const fuelIds = new Set(stockItems.filter((i) => i.fuel).map((i) => i.id));
    const fuel = used.filter((u) => fuelIds.has(u.purchase_id));
    const isFuel = (t?: string | null) => /combust|gas[oó]leo|gasolina|diesel/i.test(t || "");
    const directFuel = allExp.filter((e) => e.asset_id === id && isFuel(e.category));
    const ctbFuel = allContrib.filter((c) => c.asset_id === id && isFuel(c.note));
    const fuelKzExtra = directFuel.reduce((s, e) => s + (e.amount || 0), 0) + ctbFuel.reduce((s, c) => s + (c.amount || 0), 0);
    const fuelL = Math.round((fuel.reduce((s, u) => s + (u.quantity || 0), 0) + fuelKzExtra / 420) * 10) / 10;
    const fuelKz = fuel.reduce((s, u) => s + (u.amount || 0), 0) + fuelKzExtra;
    return { rev, exp: exp + stk, bal: rev - exp - stk, fuelL, fuelKz };
  };

  const [showNew, setShowNew] = useState(false);
  async function onNewAsset(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    try {
      await addA({ data: { name: String(f.get("name")), kind: f.get("kind") === "Equipamento" ? "Equipamento" : "Veículo", plate: String(f.get("plate") || "").trim() || null, sector } });
      toast.success("Registado.");
      setShowNew(false);
      await qc.invalidateQueries({ queryKey: ["rental-assets", sector] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao guardar (precisa de internet).");
    }
  }

  const [amount, setAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [students, setStudents] = useState("");
  const [perStudent, setPerStudent] = useState("");
  const computed = (Math.round(Number(students)) || 0) * (Math.round(Number(perStudent)) || 0);
  const [method, setMethod] = useState<"Numerário" | "Banco">("Numerário");
  const [entryDate, setEntryDate] = useState("");
  const [showEntryDate, setShowEntryDate] = useState(false);
  const [expenseDate, setExpenseDate] = useState("");
  const [showExpenseDate, setShowExpenseDate] = useState(false);
  async function onEntry(ev: React.FormEvent) {
    ev.preventDefault();
    if (!sectorEntryMode && (!current || current.kind === "Equipamento")) return;
    const value = perStudentMode ? computed : Math.round(Number(amount));
    if (!value || value <= 0) { toast.error(perStudentMode ? "Indique alunos e valor diário por aluno." : "Indique um valor válido."); return; }
    const payload = {
      sector, amount: value, payment_method: method, asset_id: sectorEntryMode ? null : current!.id,
      ...(access.isAdmin && entryDate ? { entry_date: entryDate } : {}),
      ...(perStudentMode ? { students: Math.round(Number(students)), per_student: Math.round(Number(perStudent)) } : {}),
    };
    try {
      const r = await sendOrQueue("sector_entry", payload, `${title}${sectorEntryMode ? "" : " " + current!.name}: ${formatMoney(value)} Kz`, () => addEntry({ data: payload }));
      setAmount("");
      setStudents("");
      toast.success(r === "queued" ? "Sem internet: guardado no aparelho." : "Entrada registada.");
      if (r === "sent") await Promise.all([qc.invalidateQueries({ queryKey: ["entries", sector] }), qc.invalidateQueries({ queryKey: ["finance"] })]);
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
      sector,
      category: String(f.get("category") || "Outros"),
      description: String(f.get("description") || ""),
      amount: Number(f.get("amount") || 0),
      expense_date: access.isAdmin && expenseDate ? expenseDate : todayAngola(),
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
      setExpenseDate("");
      toast.success(r === "queued" ? "Sem internet: despesa guardada no aparelho." : "Despesa registada.");
      if (r === "sent") await Promise.all([qc.invalidateQueries({ queryKey: ["expenses"] }), qc.invalidateQueries({ queryKey: ["finance"] })]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar.");
    }
  }

  async function onNewCategory() {
    const name = window.prompt("Nome da nova categoria de custo:")?.trim();
    if (!name) return;
    try {
      await addC({ data: { name } });
      setExpenseCategory(name);
      await qc.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success(`Categoria "${name}" criada e selecionada.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a categoria (precisa de internet).");
    }
  }

  // Consumo de estoque: abate ao lote comprado, sem somar às despesas gerais.
  const [usePurchase, setUsePurchase] = useState("");
  const [useQty, setUseQty] = useState("1");
  const [useValue, setUseValue] = useState("");
  const selectedLot = stockItems.find((i) => i.id === usePurchase);
  const suggested = selectedLot ? selectedLot.unit_price * (Number(useQty) || 0) : 0;

  async function onUsage(ev: React.FormEvent) {
    ev.preventDefault();
    if (!current || !selectedLot) return;
    const qty = Math.round(Number(useQty));
    if (!qty || qty <= 0) { toast.error("Indique a quantidade."); return; }
    if (qty > selectedLot.left_quantity) { toast.error("Não há essa quantidade no estoque."); return; }
    const value = Math.round(Number(useValue) || suggested);
    const payload = {
      purchase_id: selectedLot.id,
      asset_id: current.id,
      quantity: qty,
      amount: value,
      note: null as string | null,
      used_on: todayAngola(),
      sector,
    };
    try {
      const r = await sendOrQueue("stock_usage", payload, `${qty}× ${selectedLot.description} → ${current.name}`, () => addUse({ data: payload }));
      setUseQty("1");
      setUseValue("");
      toast.success(r === "queued" ? "Sem internet: guardado no aparelho." : "Estoque aplicado à unidade.");
      if (r === "sent") await qc.invalidateQueries({ queryKey: ["rental-stock"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar.");
    }
  }

  const curEntries = sectorEntryMode ? allEntries.filter((e) => !e.asset_id) : current ? allEntries.filter((e) => e.asset_id === current.id) : [];
  const curExp = current ? allExp.filter((e) => e.asset_id === current.id) : [];
  const curUsage = current ? allUsage.filter((u) => u.asset_id === current.id) : [];
  const delEntry = useServerFn(deleteSectorEntry);
  async function removeEntry(e: { id: string; pending: boolean; amount: number }) {
    if (!confirm(`Apagar a entrada de ${formatMoney(e.amount)} Kz?`)) return;
    if (e.pending) { writeQueue(readQueue().filter((q) => q.id !== e.id)); toast.success("Entrada apagada."); return; }
    try {
      await delEntry({ data: { id: e.id } });
      toast.success("Entrada apagada.");
      await Promise.all([qc.invalidateQueries({ queryKey: ["entries", sector] }), qc.invalidateQueries({ queryKey: ["finance"] })]);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Precisa de internet para apagar."); }
  }
  const badge = <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning">No aparelho</span>;

  const listFin = useServerFn(getFinance);
  const fin = useQuery({ queryKey: ["finance", range.from, range.to], queryFn: () => listFin({ data: range }), enabled: !embedded });
  const merged = useMergedFinance(fin.data, range);
  const sectorFin = merged.sectors.find((x) => x.slug === sector);

  const [tService, setTService] = useState("");
  const [tPrice, setTPrice] = useState("");
  const [tTrips, setTTrips] = useState("1");
  const [tClient, setTClient] = useState("");
  const [tStatus, setTStatus] = useState("Entregue");
  const tTotal = (Math.round(Number(tPrice)) || 0) * (Math.round(Number(tTrips)) || 0);
  async function refreshTruck() {
    await Promise.all(["truck-sales", "sector", "finance", "dashboard"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  }
  async function onTruck(ev: React.FormEvent) {
    ev.preventDefault();
    if (!current || current.kind === "Equipamento") return;
    const price = Math.round(Number(tPrice)); const trips = Math.round(Number(tTrips));
    if (!tService.trim()) { toast.error("Indique o serviço."); return; }
    if (!price || price <= 0 || !trips || trips < 1) { toast.error("Indique o valor por viagem e o nº de viagens."); return; }
    const payload = {
      asset_id: current.id, description: tService.trim(), unit_price: price, quantity: trips,
      client_name: tClient.trim() || null, status: tStatus, payment_method: method, offline_total: price * trips,
      ...(access.isAdmin && entryDate ? { entry_date: entryDate } : {}),
    };
    try {
      const r = await sendOrQueue("water_sale", payload, `${current.name}: ${payload.description} × ${trips}`, () => addTS({ data: payload }));
      toast[r === "queued" ? "info" : "success"](r === "queued" ? "Sem internet: guardado no aparelho." : "Entrada registada.");
      setTPrice(""); setTTrips("1"); setTClient("");
      if (r !== "queued") await refreshTruck();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao guardar."); }
  }
  async function truckAction(t: { id: string; pending: boolean; total: number }, action: "deliver" | "delete") {
    if (action === "delete") {
      if (!confirm(`Apagar a entrada de ${formatMoney(t.total)} Kz?`)) return;
      if (t.pending) { writeQueue(readQueue().filter((q) => q.id !== t.id)); toast.success("Entrada apagada."); return; }
    }
    try {
      if (action === "deliver") await setTS({ data: { id: t.id, status: "Entregue" } });
      else await delRec({ data: { table: "water_sales", id: t.id } });
      toast.success(action === "deliver" ? "Marcado como entregue." : "Entrada apagada.");
      await refreshTruck();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Precisa de internet."); }
  }
  const curTruck = current ? allTruck.filter((t) => t.asset_id === current.id) : [];
  const entryDateAction = access.isAdmin ? (
    <div className="flex items-center gap-2">
      {showEntryDate ? (
        <input
          type="date"
          value={entryDate}
          max={todayAngola()}
          onChange={(e) => setEntryDate(e.target.value)}
          aria-label="Data da entrada"
          className={`${inputClass} h-8 w-36 px-2 text-xs`}
        />
      ) : null}
      <button
        type="button"
        onClick={() => {
          setShowEntryDate((open) => !open);
          if (!entryDate) setEntryDate(todayAngola());
        }}
        className="h-8 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5"
        aria-expanded={showEntryDate}
      >
        <CalendarDays className="size-3.5" /> Data
      </button>
    </div>
  ) : null;
  const expenseDateAction = access.isAdmin ? (
    <div className="flex items-center gap-2">
      {showExpenseDate ? (
        <input
          type="date"
          value={expenseDate}
          max={todayAngola()}
          onChange={(e) => setExpenseDate(e.target.value)}
          aria-label="Data da despesa"
          className={`${inputClass} h-8 w-36 px-2 text-xs`}
        />
      ) : null}
      <button
        type="button"
        onClick={() => {
          setShowExpenseDate((open) => !open);
          if (!expenseDate) setExpenseDate(todayAngola());
        }}
        className="h-8 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5"
        aria-expanded={showExpenseDate}
      >
        <CalendarDays className="size-3.5" /> Data
      </button>
    </div>
  ) : null;
  const truckCard = (
              <Card title="Entradas do camião (serviços)" action={entryDateAction}>
                <form onSubmit={onTruck} className="p-4 grid grid-cols-2 gap-2 border-b border-edge">
                  <input value={tService} onChange={(e) => setTService(e.target.value)} list="truck-services" placeholder="Serviço (ex.: Carregamento cisterna)" className={`${inputClass} h-12 col-span-2`} />
                  <datalist id="truck-services">{(waterData.data?.products || []).map((p) => <option key={p.id} value={p.name} />)}</datalist>
                  <input value={tPrice} onChange={(e) => setTPrice(e.target.value)} type="number" min={1} placeholder="Kz por viagem" className={`${inputClass} h-12 text-lg font-display`} />
                  <input value={tTrips} onChange={(e) => setTTrips(e.target.value)} type="number" min={1} placeholder="Nº de viagens" className={`${inputClass} h-12 text-lg font-display`} />
                  <input value={tClient} onChange={(e) => setTClient(e.target.value)} placeholder="Nome do cliente" className={`${inputClass} h-12 col-span-2`} />
                  <select value={tStatus} onChange={(e) => setTStatus(e.target.value)} className={`${inputClass} h-12`}><option>Entregue</option><option>Pendente</option></select>
                  <select value={method} onChange={(e) => setMethod(e.target.value as "Numerário" | "Banco")} className={`${inputClass} h-12`}>
                    <option value="Numerário">Numerário</option><option value="Banco">Banco (VB)</option>
                  </select>
                  <button className="col-span-2 h-12 rounded-md bg-warning text-primary-foreground font-medium flex items-center justify-center gap-2"><Plus className="size-4" /> Registar · {formatMoney(tTotal)} Kz</button>
                </form>
                <ul className="divide-y divide-edge/60 max-h-80 overflow-auto">
                  {curTruck.length === 0 && <li className="p-5 text-sm text-muted-foreground">Sem entradas neste período.</li>}
                  {curTruck.map((t) => (
                    <li key={t.id} className="flex justify-between items-center px-5 py-3 text-sm gap-3">
                      <span className="text-muted-foreground min-w-0">
                        <span className="text-foreground">{t.description} × {t.quantity}</span>
                        <span className="text-[11px]"> · {t.client_name || "—"} · {new Date(t.created_at).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" })}{t.payment_method === "Banco" ? " · VB" : ""}</span>
                        <span className={`ml-2 text-[11px] ${t.status === "Pendente" ? "text-warning" : ""}`}>{t.status}</span>
                        {t.pending ? badge : null}
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="font-display text-warning">+{formatMoney(t.total)}</span>
                        {t.status === "Pendente" && !t.pending && (
                          <button onClick={() => truckAction(t, "deliver")} className="text-xs px-2 py-1 rounded bg-success/15 text-success">Entregue</button>
                        )}
                        {(access.isAdmin || t.pending) && (
                          <button onClick={() => truckAction(t, "delete")} aria-label="Apagar entrada" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
  );

  const entriesCard = (
              <Card title={sectorEntryMode ? "Entradas do setor" : "Entradas"} action={entryDateAction}>
                <form onSubmit={onEntry} className="p-4 grid grid-cols-2 gap-2 border-b border-edge">
                  {perStudentMode ? (
                    <>
                      <input value={students} onChange={(e) => setStudents(e.target.value)} type="number" min={1} placeholder="Nº alunos" className={`${inputClass} h-12 text-lg font-display`} />
                      <input value={perStudent} onChange={(e) => setPerStudent(e.target.value)} type="number" min={0} placeholder="Kz/aluno/dia" className={`${inputClass} h-12 text-lg font-display`} />
                    </>
                  ) : (
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={1} placeholder="Valor (Kz)" className={`${inputClass} h-12 text-lg font-display col-span-2`} />
                  )}
                  <select value={method} onChange={(e) => setMethod(e.target.value as "Numerário" | "Banco")} className={`${inputClass} h-12`}>
                    <option value="Numerário">Numerário</option><option value="Banco">Banco (VB)</option>
                  </select>
                  <button className="h-12 rounded-md bg-warning text-primary-foreground font-medium flex items-center justify-center gap-2"><Plus className="size-4" /> Registar</button>
                </form>
                {perStudentMode && (
                  <p className="px-4 py-2 text-xs text-muted-foreground border-b border-edge">
                    Total do dia: <span className="font-display text-warning">{formatMoney(computed)} Kz</span>
                  </p>
                )}
                <ul className="divide-y divide-edge/60 max-h-80 overflow-auto">
                  {curEntries.length === 0 && <li className="p-5 text-sm text-muted-foreground">Sem entradas neste período.</li>}
                  {curEntries.map((e) => (
                    <li key={e.id} className="flex justify-between items-center px-5 py-3 text-sm gap-3">
                      <span className="text-muted-foreground min-w-0">
                        {new Date(e.created_at).toLocaleString("pt-AO")}{e.payment_method === "Banco" ? " · VB" : ""}
                        {e.students ? <span className="text-[11px]"> · {e.students} alunos × {formatMoney(e.per_student || 0)}</span> : null}
                        {e.pending ? badge : null}
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="font-display text-warning">+{formatMoney(e.amount)}</span>
                        {(access.isAdmin || e.pending) && (
                          <button onClick={() => removeEntry(e)} aria-label="Apagar entrada" className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
  );

  const body = (
      <div className={embedded ? "space-y-5" : "flex-1 overflow-auto p-6 space-y-5"}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">{periodLabel(preset, range)}</p>
          <button onClick={() => setShowNew((v) => !v)} className="h-10 px-4 rounded-md bg-brand text-primary-foreground text-sm font-medium flex items-center gap-2">
            <Plus className="size-4" /> {equipmentOnly ? "Cadastrar equipamento" : "Cadastrar veículo / equipamento"}
          </button>
        </div>

        {showNew && (
          <form onSubmit={onNewAsset} className="rounded-xl bg-panel ring-1 ring-edge p-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2"><label className={label}>Nome</label><input name="name" required placeholder="Ex.: Toyota Hilux, Gerador 50kVA" className={`${inputClass} mt-1.5`} /></div>
            <div><label className={label}>Tipo</label><select name="kind" className={`${inputClass} mt-1.5`}>{!equipmentOnly && <option>Veículo</option>}<option>Equipamento</option></select></div>
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
                  <div className="mt-3 rounded-md bg-primary/10 ring-1 ring-primary/30 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Fuel className="size-3.5 text-primary" /> Combustível</span>
                    <span className="text-right">
                      <span className="font-display text-foreground text-sm">{s.fuelL.toLocaleString("pt-AO")} L</span>
                      {access.isAdmin && <span className="block text-[11px] text-muted-foreground">{formatMoney(s.fuelKz)} Kz{s.rev > 0 ? ` · ${Math.round((s.fuelKz / s.rev) * 100)}% da receita` : ""}</span>}
                    </span>
                  </div>
                  <div className={`mt-3 grid gap-2 text-xs ${access.isAdmin ? "grid-cols-3" : "grid-cols-1"}`}>
                    {a.kind !== "Equipamento" && !sectorEntryMode ? <div><p className="text-muted-foreground">Entradas</p><p className="font-display text-warning">{formatMoney(s.rev)}</p></div> : !access.isAdmin ? <div><p className="text-muted-foreground">Equipamento — só custos</p></div> : null}
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

        {afterAssets}

        {!embedded && sectorFin && (
          <>
            <section className={`grid gap-3 ${"grid-cols-1 md:grid-cols-3"}`}>
              <Stat label="Receita total" value={sectorFin.revenue} tone="text-warning" />
              <Stat label="Despesa total" value={sectorFin.expense} tone="text-destructive" />
              <CashBalanceCard total={sectorFin.balance} cash={sectorFin.cash} bank={sectorFin.bank} />
            </section>
            <DebtCard sector={sector} />
            <Card title="Evolução do setor">
              <div className="h-64 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sectorFin.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} width={70} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="receitas" name="Receitas" stroke="var(--warning)" fill="var(--warning)" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="despesas" name="Despesas" stroke="var(--destructive)" fill="var(--destructive)" fillOpacity={0.1} strokeWidth={2} />
                    <Line type="monotone" dataKey="saldo" name="Saldo" stroke="var(--success)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </>
        )}
        {sectorEntryMode && entriesCard}
        <Card title="Estoque de peças e materiais">
          <ul className="divide-y divide-edge/60 max-h-80 overflow-auto">
            {stockItems.length === 0 && (
              <li className="p-5 text-sm text-muted-foreground">
                Ainda não há compras de estoque. Registe-as no Centro de Custos (Água, Lavagem, Transporte ou Aluguer) — o estoque é partilhado.
              </li>
            )}
            {stockItems.map((i) => (
              <li key={i.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-foreground truncate flex items-center gap-2">
                    <Package className="size-3.5 text-primary shrink-0" />
                    {i.description}
                    {i.fuel && <span className="text-[10px] uppercase tracking-wide rounded bg-primary/15 text-primary px-1.5 py-0.5">Combustível</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(i.purchase_date).toLocaleDateString("pt-AO")} · {formatMoney(i.unit_price)} Kz por {i.fuel ? "litro" : "unidade"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-display ${i.left_quantity > 0 ? "text-success" : "text-muted-foreground"}`}>
                    {i.left_quantity} de {i.quantity}{i.fuel ? " L" : ""}
                  </p>
                  {access.isAdmin && (
                    <p className="text-[11px] text-muted-foreground">
                      Resta {formatMoney(Math.max(0, i.left_amount))} de {formatMoney(i.amount)} Kz
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {current && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg uppercase tracking-wide text-foreground">{current.name}</h2>
              {access.isAdmin && (
                <button
                  onClick={async () => {
                    if (!confirm(`Apagar ${current.name}? Os registos ficam no setor sem unidade.`)) return;
                    try { await delA({ data: { id: current.id } }); setSelected(null); await qc.invalidateQueries({ queryKey: ["rental-assets", sector] }); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                ><Trash2 className="size-3.5" /> Apagar unidade</button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {!sectorEntryMode && current.kind !== "Equipamento" && (truckMode ? truckCard : entriesCard)}

              {sector !== "lavagem" && (
              <Card title="Centro de custos" action={expenseDateAction}>
                <form onSubmit={onExpense} className="p-4 grid grid-cols-2 gap-2 border-b border-edge">
                  <input name="description" required placeholder="Descrição" className={`${inputClass} col-span-2`} />
                  <input name="amount" type="number" min={1} required placeholder="Valor (Kz)" className={`${inputClass} h-12 text-lg font-display col-span-2`} />
                  <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <select
                      name="category"
                      value={categories.includes(expenseCategory) ? expenseCategory : categories[0]}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      aria-label="Categoria da despesa"
                      className={inputClass}
                    >
                      {categories.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={onNewCategory}
                      className="h-10 px-3 rounded-md ring-1 ring-edge bg-panel text-sm font-medium text-primary hover:bg-primary/10"
                    >
                      <Plus className="size-4 inline-block mr-1" /> Nova categoria
                    </button>
                  </div>
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
              )}

              <Card title={`Consumo de estoque — ${current.name}`}>
                <form onSubmit={onUsage} className="p-4 grid grid-cols-2 gap-2 border-b border-edge">
                  <select
                    value={usePurchase}
                    onChange={(e) => { setUsePurchase(e.target.value); setUseValue(""); }}
                    className={`${inputClass} col-span-2`}
                  >
                    <option value="">Escolher item do estoque…</option>
                    {stockItems.filter((i) => i.left_quantity > 0).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.fuel ? "⛽ " : ""}{i.description} — {i.left_quantity} {i.fuel ? "L" : ""} disponíveis
                      </option>
                    ))}
                  </select>
                  <input
                    value={useQty}
                    onChange={(e) => setUseQty(e.target.value)}
                    type="number"
                    min={1}
                    placeholder={selectedLot?.fuel ? "Litros" : "Quantidade"}
                    className={`${inputClass} h-12 text-lg font-display`}
                  />
                  <input
                    value={useValue}
                    onChange={(e) => setUseValue(e.target.value)}
                    type="number"
                    min={0}
                    placeholder={suggested ? `${formatMoney(suggested)} Kz` : "Valor (Kz)"}
                    className={`${inputClass} h-12 text-lg font-display`}
                  />
                  <p className="col-span-2 text-[11px] text-muted-foreground">
                    Sai do estoque e fica no custo da unidade. Não entra nas despesas gerais do período.
                  </p>
                  <button
                    disabled={!usePurchase}
                    className="col-span-2 h-10 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
                  >
                    Aplicar na unidade
                  </button>
                </form>
                <ul className="divide-y divide-edge/60 max-h-80 overflow-auto">
                  {curUsage.length === 0 && <li className="p-5 text-sm text-muted-foreground">Nada aplicado a esta unidade.</li>}
                  {curUsage.map((u) => {
                    const lot = stockItems.find((i) => i.id === u.purchase_id);
                    return (
                      <li key={u.id} className="flex justify-between px-5 py-3 text-sm gap-3">
                        <span className="text-muted-foreground min-w-0 truncate">
                          {u.used_on} · {lot?.fuel ? `${u.quantity} L de` : `${u.quantity}×`} {lot?.description || "Item de estoque"}
                          {u.pending ? badge : null}
                        </span>
                        <span className="font-display text-primary shrink-0">−{formatMoney(u.amount || 0)}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          </>
        )}
      </div>
  );

  if (embedded) return body;
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <PageHeader
        dot={dot}
        title={title}
        subtitle={subtitle}
        action={<PeriodPicker preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />}
      />
      {body}
    </div>
  );
}

function Stat({ label: l, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-panel ring-1 ring-edge p-4">
      <p className={label}>{l}</p>
      <p className={`mt-1.5 font-display text-2xl ${tone}`}>{formatMoney(value)}</p>
    </div>
  );
}
