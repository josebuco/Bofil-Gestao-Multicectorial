import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Package, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExpandableCard, PageHeader, PeriodPicker, formatMoney, inputClass, usePeriod } from "@/components/panel";
import { useAccess } from "@/lib/use-access";
import { FUEL_PRICE_PER_LITER, stockPurchaseAmount } from "@/lib/stock";
import { STOCK_CATEGORY, createStockUsage } from "@/lib/rental.functions";
import { createExpense } from "@/lib/expenses.functions";
import { getVehicleControlData, type VehicleControlAsset } from "@/lib/vehicle-control.functions";
import { canSeeVehicleFinancials, vehicleRangeForAccess, vehicleTotals } from "@/lib/vehicle-control";
import { sendOrQueue, useQueue } from "@/lib/offline";
import { angolaParts, todayAngola } from "@/lib/tz";

const SECTORS = [
  { slug: "agua", label: "Água", color: "bg-water" },
  { slug: "lavagem", label: "Estação 4 de Abril", color: "bg-wash" },
  { slug: "transporte", label: "Transporte", color: "bg-transport" },
  { slug: "aluguer", label: "Aluguer", color: "bg-primary" },
] as const;

export function VehicleControlPage() {
  const access = useAccess();
  const period = usePeriod("mes");
  const { range, preset, setPreset, custom, setCustom } = period;
  const getData = useServerFn(getVehicleControlData);
  const queryClient = useQueryClient();
  const makeExpense = useServerFn(createExpense);
  const addUsage = useServerFn(createStockUsage);
  const hasTabPermission = access.isAdmin || access.sectors.includes("veiculos");
  const loadingAccess = "loading" in access;
  const [filter, setFilter] = useState("todos");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [today, setToday] = useState(todayAngola());
  useEffect(() => {
    const timer = setInterval(() => setToday(todayAngola()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const effectiveRange = vehicleRangeForAccess(access.isAdmin, range, today);
  const query = useQuery({
    queryKey: ["vehicle-control", effectiveRange.from, effectiveRange.to],
    queryFn: () => getData({ data: effectiveRange }),
    enabled: hasTabPermission,
    staleTime: 30_000,
  });
  const queue = useQueue();
  const assets = query.data?.assets || [];
  const queuedDate = (item: (typeof queue)[number], key: string) => {
    const explicit = item.data[key];
    if (typeof explicit === "string" && /^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
    const parts = angolaParts(item.at);
    return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
  };
  const inRange = (day: string) => day >= effectiveRange.from && day <= effectiveRange.to;
  const visibleAssets = assets.filter((asset) => filter === "todos" || asset.sector === filter);

  function getVehicleView(asset: VehicleControlAsset) {
    const financials = canSeeVehicleFinancials(access.isAdmin, access.sectors, asset.sector);
    const entries = financials ? [
      ...(query.data?.entries || []).filter((entry) => entry.asset_id === asset.id),
      ...queuedEntries.filter((item) => item.data["asset_id"] === asset.id).map((item) => ({
        id: item.id,
        asset_id: asset.id,
        amount: Number(item.data["amount"]) || 0,
        cost: Number(item.data["cost"]) || 0,
        status: String(item.data["status"] || "Pago"),
        payment_method: String(item.data["payment_method"] || "Numerário"),
        created_at: String(item.data["entry_date"] ? `${item.data["entry_date"]}T12:00:00+01:00` : item.at),
        local: true,
      })),
    ] : [];
    const sales = financials ? [
      ...(query.data?.truckSales || []).filter((sale) => sale.asset_id === asset.id).map((sale) => ({ ...sale, amount: sale.total || 0 })),
      ...queuedWater.filter((item) => item.data["asset_id"] === asset.id).map((item) => ({
        id: item.id,
        asset_id: asset.id,
        description: String(item.data["description"] || "Serviço"),
        quantity: Number(item.data["quantity"]) || 0,
        amount: Number(item.data["offline_total"]) || 0,
        total: Number(item.data["offline_total"]) || 0,
        status: String(item.data["status"] || "Entregue"),
        payment_method: String(item.data["payment_method"] || "Numerário"),
        created_at: item.at,
        local: true,
      })),
    ] : [];
    const expenses = financials ? [
      ...(query.data?.expenses || []).filter((expense) => expense.asset_id === asset.id),
      ...(query.data?.contributions || []).filter((contribution) => contribution.asset_id === asset.id).map((contribution) => ({
        id: contribution.id,
        asset_id: asset.id,
        sector: asset.sector,
        category: "Centro de Custos",
        description: contribution.note || "Fatura do Centro de Custos",
        amount: Number(contribution.amount) || 0,
        expense_date: contribution.transfer_date,
        status: "Pago",
        payment_method: "",
        local: false,
      })),
      ...queuedExpenses.filter((item) => item.data["asset_id"] === asset.id && inRange(queuedDate(item, "expense_date"))).map((item) => ({
        id: item.id,
        asset_id: asset.id,
        sector: String(item.data["sector"] || asset.sector),
        category: String(item.data["category"] || "Outros"),
        description: String(item.data["description"] || "Despesa"),
        amount: Number(item.data["amount"]) || 0,
        expense_date: String(item.data["expense_date"] || item.at.slice(0, 10)),
        status: String(item.data["status"] || "Pendente"),
        payment_method: String(item.data["payment_method"] || "Numerário"),
        local: true,
      })),
    ] : [];
    const uses = [
      ...(query.data?.usages || []).filter((usage) => usage.asset_id === asset.id),
      ...queuedUsages.filter((item) => item.data["asset_id"] === asset.id && inRange(queuedDate(item, "used_on"))).map((item) => ({
        id: item.id,
        purchase_id: String(item.data["purchase_id"] || ""),
        asset_id: asset.id,
        quantity: Number(item.data["quantity"]) || 0,
        amount: Number(item.data["amount"]) || 0,
        note: typeof item.data["note"] === "string" ? item.data["note"] : null,
        used_on: String(item.data["used_on"] || item.at.slice(0, 10)),
        local: true,
      })),
    ];
    const totals = financials
      ? vehicleTotals(
        [
          ...entries.map((entry) => ({ amount: entry.amount, cost: entry.cost, status: entry.status })),
          ...sales.map((sale) => ({ amount: sale.amount, cost: 0, status: sale.status })),
        ],
        expenses.map((expense) => ({ amount: expense.amount, status: expense.status })),
        uses.filter((usage) => stockItems.find((item) => item.id === usage.purchase_id)?.asset_id !== asset.id),
      )
      : { revenue: 0, expense: uses.reduce((sum, usage) => sum + (usage.amount || 0), 0), balance: 0 };
    const consumedLiters = uses.reduce((sum, usage) => {
      const item = stockItems.find((stockItem) => stockItem.id === usage.purchase_id);
      return item?.fuel ? sum + (usage.quantity || 0) : sum;
    }, 0);
    return { financials, entries, sales, expenses, uses, totals, consumedLiters };
  }
  const selectedAsset = visibleAssets.find((asset) => asset.id === selectedVehicleId) || null;
  const selectedView = selectedAsset ? getVehicleView(selectedAsset) : null;

  const queuedExpenses = queue.filter((item) => item.kind === "expense" && item.data["asset_id"]);
  const queuedUsages = queue.filter((item) => item.kind === "stock_usage" && item.data["asset_id"]);
  const queuedEntries = queue.filter((item) => item.kind === "sector_entry" && item.data["asset_id"] && inRange(queuedDate(item, "entry_date")));
  const queuedWater = queue.filter((item) => item.kind === "water_sale" && item.data["asset_id"] && inRange(queuedDate(item, "entry_date")));
  const stockItems = useMemo(() => {
    const serverItems = query.data?.stockItems || [];
    const localPurchases = queue
      .filter((item) => item.kind === "expense" && item.data["vehicle_stock_purchase"] === true && item.data["status"] === "Pago")
      .map((item) => {
        const quantity = Number(item.data["quantity"]) || 0;
        const amount = Number(item.data["amount"]) || 0;
        return {
          id: item.id,
          description: String(item.data["description"] || STOCK_CATEGORY),
          supplier: typeof item.data["supplier"] === "string" ? item.data["supplier"] : null,
          sector: String(item.data["sector"] || "agua"),
          asset_id: typeof item.data["asset_id"] === "string" ? item.data["asset_id"] : null,
          fuel: item.data["stock_unit"] === "litro",
          purchase_date: String(item.data["expense_date"] || item.at.slice(0, 10)),
          quantity,
          amount,
          unit_price: quantity > 0 ? amount / quantity : 0,
          left_quantity: quantity,
          left_amount: amount,
          pending: true,
        };
      });
    const localUseByLot = new Map<string, number>();
    queuedUsages.forEach((item) => {
      const lotId = String(item.data["purchase_id"] || "");
      localUseByLot.set(lotId, (localUseByLot.get(lotId) || 0) + (Number(item.data["quantity"]) || 0));
    });
    return [...localPurchases, ...serverItems].map((item) => {
      const localUsed = localUseByLot.get(item.id) || 0;
      return { ...item, left_quantity: item.left_quantity - localUsed, left_amount: item.left_amount - localUsed * item.unit_price };
    });
  }, [query.data, queue, queuedUsages]);

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vehicle-control"] }),
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      queryClient.invalidateQueries({ queryKey: ["rental-stock"] }),
      queryClient.invalidateQueries({ queryKey: ["finance"] }),
    ]);
  }

  if (loadingAccess) return <div className="flex-1 p-6 text-sm text-muted-foreground">A verificar permissões…</div>;
  if (!hasTabPermission) {
    return <div className="flex-1 p-6 text-sm text-muted-foreground">Esta conta não tem acesso a esta aba.</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <PageHeader
        dot="bg-primary"
        title="Controle de consumo dos veículos"
        subtitle="Consumos, entradas e estoque partilhado por viatura"
        action={<PeriodPicker preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />}
      />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar veículos por setor">
          {[{ slug: "todos", label: "Todos" }, ...SECTORS].map((sector) => (
            <Button
              key={sector.slug}
              type="button"
              onClick={() => setFilter(sector.slug)}
              aria-pressed={filter === sector.slug}
              variant={filter === sector.slug ? "default" : "outline"}
              className="h-8 px-3 text-xs"
            >
              {sector.label}
            </Button>
          ))}
        </div>

        {query.isPending ? <p className="py-8 text-center text-sm text-muted-foreground">A carregar veículos…</p> : null}
        {query.isError ? <p className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">Não foi possível actualizar os veículos. Os dados guardados poderão continuar disponíveis.</p> : null}
        {!query.isPending && !query.isError && assets.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há veículos cadastrados.</p> : null}
        {!query.isPending && !query.isError && assets.length > 0 && visibleAssets.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Não há veículos neste setor.</p> : null}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleAssets.map((asset) => {
            const view = getVehicleView(asset);
            return <VehicleCard
              key={asset.id}
              asset={asset}
              selected={asset.id === selectedAsset?.id}
              financials={view.financials}
              totals={view.totals}
              consumedLiters={view.consumedLiters}
              onSelect={() => setSelectedVehicleId((current) => current === asset.id ? null : asset.id)}
            />;
          })}
        </section>
        {selectedAsset && selectedView ? (
          <VehicleOperations
            key={selectedAsset.id}
            asset={selectedAsset}
            {...selectedView}
            stockItems={stockItems}
            today={today}
            makeExpense={makeExpense}
            addUsage={addUsage}
            refresh={refreshData}
            onClose={() => setSelectedVehicleId(null)}
          />
        ) : null}
      </main>
    </div>
  );
}

type StockView = { id: string; description: string; sector: string; asset_id?: string | null; fuel: boolean; purchase_date: string; quantity: number; amount: number; unit_price: number; left_quantity: number; left_amount: number; pending?: boolean };
type RecordView = { id: string; amount: number; status?: string; created_at?: string; expense_date?: string; description?: string | null; category?: string; cost?: number; payment_method?: string; quantity?: number; total?: number; purchase_id?: string; used_on?: string; local?: boolean; pending?: boolean };

function VehicleCard({
  asset, financials, totals, entries, sales, expenses, uses, stockItems,
  today, makeExpense, addUsage, refresh,
}: {
  asset: VehicleControlAsset;
  financials: boolean;
  totals: { revenue: number; expense: number; balance: number };
  entries: RecordView[];
  sales: RecordView[];
  expenses: RecordView[];
  uses: RecordView[];
  stockItems: StockView[];
  today: string;
  makeExpense: ReturnType<typeof useServerFn<typeof createExpense>>;
  addUsage: ReturnType<typeof useServerFn<typeof createStockUsage>>;
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<"litro" | "unidade">("litro");
  const [buyQuantity, setBuyQuantity] = useState("1");
  const [buyTotal, setBuyTotal] = useState("");
  const [usePurchase, setUsePurchase] = useState("");
  const [useQuantity, setUseQuantity] = useState("1");
  const purchaseAmount = stockPurchaseAmount(unit, Number(buyQuantity) || 0, Number(buyTotal) || 0);
  const selectedLot = stockItems.find((item) => item.id === usePurchase);
  const useAmount = Math.round((selectedLot?.unit_price || 0) * (Number(useQuantity) || 0) * 100) / 100;
  const icon = asset.kind === "Equipamento" ? <Package className="size-4 text-primary" /> : <Truck className="size-4 text-primary" />;
  const sector = SECTORS.find((item) => item.slug === asset.sector);
  const sourceEntries = [...entries, ...sales];
  const history = [
      ...(financials
        ? sourceEntries.map((row) => ({ id: row.id, date: row.created_at || "", description: "Entrada", amount: row.amount, type: "entrada", status: row.status, local: row.local || row.pending }))
        : sourceEntries.filter((row) => (row.cost || 0) > 0).map((row) => ({ id: row.id, date: row.created_at || "", description: "Custo da entrada", amount: row.cost || 0, type: "despesa", status: row.status, local: row.local || row.pending }))),
    ...expenses.map((row) => ({ id: row.id, date: row.expense_date || "", description: row.description || row.category || "Despesa", amount: row.amount, type: "despesa", status: row.status, local: row.local || row.pending })),
    ...uses.map((row) => ({ id: row.id, date: row.used_on || "", description: `Consumo · ${stockItems.find((item) => item.id === row.purchase_id)?.description || "Estoque"}${row.quantity ? ` · ${row.quantity}${stockItems.find((item) => item.id === row.purchase_id)?.fuel ? " L" : " un."}` : ""}`, amount: row.amount, type: "despesa", status: row.status, local: row.local || row.pending })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  async function submitPurchase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const quantity = Number(buyQuantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error("Indique uma quantidade inteira válida.");
      return;
    }
    if (!String(form.get("description") || "").trim() || (unit === "unidade" && purchaseAmount <= 0)) {
      toast.error("Indique o item e o valor total da compra.");
      return;
    }
    const payload = {
      sector: asset.sector,
      category: STOCK_CATEGORY,
      description: String(form.get("description") || "").trim(),
      amount: purchaseAmount,
      expense_date: today,
      supplier: String(form.get("supplier") || "").trim() || null,
      status: "Pago",
      invoice_path: null,
      notes: null,
      payment_method: form.get("payment_method") === "Banco" ? "Banco" as const : "Numerário" as const,
      asset_id: asset.id,
      quantity,
      stock_unit: unit,
      sector_stock_purchase: true,
      vehicle_stock_purchase: true,
    };
    try {
      const result = await sendOrQueue("expense", payload, `Compra de estoque para ${asset.name}: ${payload.description}`, () => makeExpense({ data: payload }));
      formElement.reset();
      setBuyQuantity("1");
      setBuyTotal("");
      toast.success(result === "queued" ? "Compra guardada neste aparelho; ficará disponível após sincronizar." : "Compra registada e estoque partilhado actualizado.");
      if (result === "sent") await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registar a compra.");
    }
  }

  async function submitUsage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(useQuantity);
    if (!selectedLot || selectedLot.pending || !Number.isInteger(quantity) || quantity < 1 || quantity > selectedLot.left_quantity) {
      toast.error("Escolha um lote disponível e uma quantidade válida.");
      return;
    }
    const payload = {
      purchase_id: selectedLot.id,
      asset_id: asset.id,
      quantity,
      amount: useAmount,
      note: null,
      used_on: today,
      sector: asset.sector,
      vehicle_control: true,
    };
    try {
      const result = await sendOrQueue("stock_usage", payload, `Consumo ${selectedLot.description} → ${asset.name}`, () => addUsage({ data: payload }));
      setUseQuantity("1");
      toast.success(result === "queued" ? "Consumo guardado neste aparelho." : "Consumo registado.");
      if (result === "sent") await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registar o consumo.");
    }
  }

  return (
    <article className="min-w-0 overflow-hidden rounded-lg bg-panel ring-1 ring-edge shadow-sm">
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-ink ring-1 ring-edge">{icon}</span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-sm font-semibold uppercase text-foreground">{asset.name}</h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{asset.kind}{asset.plate ? ` · ${asset.plate}` : ""}</p>
            <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground ${sector?.color || "bg-primary"}`}>{sector?.label || asset.sector}</span>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => setOpen((value) => !value)} aria-label={open ? `Fechar ${asset.name}` : `Abrir ${asset.name}`}>
          <ChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-3">
        {financials ? (
          <>
            <Metric label="Entradas" amount={totals.revenue} tone="text-warning" />
            <Metric label="Custos" amount={totals.expense} tone="text-destructive" />
            <Metric label="Saldo" amount={totals.balance} tone={totals.balance >= 0 ? "text-success" : "text-destructive"} />
          </>
        ) : (
          <Metric label="Custos" amount={totals.expense} tone="text-destructive" />
        )}
      </div>
      {open ? <div className="space-y-4 border-t border-edge p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{financials ? "Valores do período" : "Custos do período"}</p>
          {!financials ? <span className="text-[11px] text-muted-foreground">Entradas e saldo não disponíveis nesta permissão.</span> : null}
        </div>

        {asset.kind === "Veículo" ? (
          <div className="grid gap-3 xl:grid-cols-2">
            <ExpandableCard title={`Comprar estoque · ${asset.name}`} summary="A compra é paga pelo veículo e o lote fica partilhado">
              <form onSubmit={submitPurchase} className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                <input name="description" required placeholder="Item (ex.: Gasóleo)" className={`${inputClass} col-span-2 sm:col-span-1`} />
                <select value={unit} onChange={(event) => { setUnit(event.target.value as "litro" | "unidade"); setBuyTotal(""); }} aria-label="Tipo de estoque" className={inputClass}>
                  <option value="litro">Combustível (litros)</option><option value="unidade">Peças e materiais</option>
                </select>
                <input value={buyQuantity} onChange={(event) => setBuyQuantity(event.target.value)} type="number" step="1" min="1" required aria-label="Quantidade comprada" placeholder={unit === "litro" ? "Litros" : "Quantidade"} className={inputClass} />
                {unit === "litro" ? <div className={`${inputClass} flex items-center text-xs text-muted-foreground`}>{formatMoney(purchaseAmount)} · {FUEL_PRICE_PER_LITER} Kz/L</div> : <input value={buyTotal} onChange={(event) => setBuyTotal(event.target.value)} type="number" step="any" min="0.01" required placeholder="Total (Kz)" className={inputClass} />}
                <select name="payment_method" aria-label="Forma de pagamento" className={inputClass}><option>Numerário</option><option>Banco</option></select>
                <input name="supplier" placeholder="Fornecedor (opcional)" className={`${inputClass} col-span-2 sm:col-span-1`} />
                <button className="col-span-2 h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground sm:col-span-3">Registar compra · {formatMoney(purchaseAmount)}</button>
              </form>
            </ExpandableCard>

            <ExpandableCard title={`Registar consumo · ${asset.name}`} summary="Retira material do estoque partilhado">
              <form onSubmit={submitUsage} className="grid grid-cols-2 gap-2 p-3">
                <select value={usePurchase} onChange={(event) => { setUsePurchase(event.target.value); setUseQuantity("1"); }} className={`${inputClass} col-span-2`} aria-label="Lote de estoque">
                  <option value="">Escolher item disponível…</option>
                  {stockItems.filter((item) => item.left_quantity > 0).map((item) => <option key={item.id} value={item.id} disabled={item.pending}>{item.fuel ? "Combustível · " : ""}{item.description} — {item.left_quantity}{item.fuel ? " L" : " un."}{item.pending ? " · aguarda sincronização" : ""}</option>)}
                </select>
                <input value={useQuantity} onChange={(event) => setUseQuantity(event.target.value)} type="number" step="1" min="1" max={selectedLot?.left_quantity} aria-label="Quantidade consumida" placeholder="Quantidade" className={inputClass} />
                <div className={`${inputClass} flex items-center text-xs text-muted-foreground`}>{formatMoney(useAmount)} Kz de custo</div>
                <button disabled={!selectedLot || selectedLot.pending} className="col-span-2 h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">Registar consumo</button>
              </form>
            </ExpandableCard>
          </div>
        ) : null}

        <ExpandableCard title="Histórico do veículo" summary={`${history.length} registo${history.length === 1 ? "" : "s"}`}>
          <ul className="max-h-72 divide-y divide-edge/60 overflow-auto">
            {history.length === 0 ? <li className="p-4 text-sm text-muted-foreground">Sem registos neste período.</li> : null}
            {history.map((row) => (
              <li key={`${row.type}-${row.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">{row.date} · {row.description}{row.status === "Pendente" ? " · Pendente" : ""}{row.local ? " · No aparelho" : ""}</span>
                {row.status !== "Pendente" && (financials || row.type !== "entrada") ? <span className={`shrink-0 font-display ${row.type === "entrada" ? "text-warning" : "text-destructive"}`}>{row.type === "entrada" ? "+" : "−"}{formatMoney(row.amount)}</span> : null}
              </li>
            ))}
          </ul>
        </ExpandableCard>
      </div> : null}
    </article>
  );
}

function Metric({ label, amount, tone }: { label: string; amount: number; tone: string }) {
  return <div className="rounded-md bg-ink px-3 py-2 ring-1 ring-edge"><p className="text-[10px] uppercase text-muted-foreground">{label}</p><p className={`mt-1 break-words font-display text-sm ${tone}`}>{formatMoney(amount)}</p></div>;
}