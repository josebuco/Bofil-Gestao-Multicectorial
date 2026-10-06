import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import {
  Area,
  ComposedChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  addBankDeposit,
  deleteBankDeposit,
  getCashAvailable,
  getFinance,
} from "@/lib/finance.functions";
import { periodLabel } from "@/lib/period";
import {
  Card,
  CashBalanceCard,
  Kpi,
  PageHeader,
  PeriodPicker,
  Td,
  Th,
  formatMoney,
  inputClass,
  usePeriod,
} from "@/components/panel";
import { chartTooltip } from "@/components/sector-cash";
import { useMergedFinance } from "@/lib/offline-finance";

export const Route = createFileRoute("/_authenticated/faturacao")({
  head: () => ({
    meta: [
      { title: "Faturação por Setor — Bofil" },
      {
        name: "description",
        content: "Receitas, despesas e saldo de caixa de cada setor da empresa.",
      },
      { property: "og:title", content: "Faturação por Setor — Bofil" },
      {
        property: "og:description",
        content: "Receitas, despesas e saldo de caixa de cada setor da empresa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FaturacaoPage,
});

const SECTOR_COLORS: Record<string, string> = {
  agua: "var(--water)",
  restaurante: "var(--restaurant)",
  lavagem: "var(--wash)",
  transporte: "var(--transport)",
  aluguer: "var(--primary)",
  geral: "var(--brand)",
};

function FaturacaoPage() {
  const { preset, setPreset, custom, setCustom, range } = usePeriod("mes");
  const [tab, setTab] = useState<string>("todos");

  const { data, isPending } = useQuery({
    queryKey: ["finance", range.from, range.to],
    queryFn: () => getFinance({ data: range }),
  });

  const qc = useQueryClient();
  const [depSector, setDepSector] = useState("agua");
  const [depAmount, setDepAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["finance"] });
    qc.invalidateQueries({ queryKey: ["cashAvailable"] });
  };
  const { data: avail } = useQuery({
    queryKey: ["cashAvailable", depSector],
    queryFn: () => getCashAvailable({ data: { sector: depSector } }),
  });
  const availableCash = avail?.available ?? 0;
  const deposit = async () => {
    const amount = (Math.round(Number(depAmount) * 100) / 100);
    if (!amount || amount <= 0) { toast.error("Indique o valor do depósito."); return; }
    if (amount > availableCash) {
      toast.error(
        `Saldo de caixa insuficiente: disponível apenas ${formatMoney(availableCash)}.`,
      );
      return;
    }
    setSaving(true);
    try {
      await addBankDeposit({ data: { sector: depSector, amount } });
      toast.success("Depósito registado: saiu do caixa e entrou no banco.");
      setDepAmount("");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const removeDeposit = async (id: string) => {
    if (!confirm("Apagar este depósito?")) return;
    try {
      await deleteBankDeposit({ data: { id } });
      toast.success("Depósito apagado.");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const finance = useMergedFinance(data, range);
  const sectors = finance.sectors;
  const sector = sectors.find((s) => s.slug === tab);
  const allEntries = finance.entries;
  const entries = tab === "todos" ? allEntries : allEntries.filter((e) => e.sector === tab);

  const revenue = sector ? sector.revenue : finance.totals.revenue;
  const bankTotal = sector ? sector.bank : finance.totals.bank;
  const expense = sector ? sector.expense : finance.totals.expense;
  const pending = sector ? sector.pendingExpense : finance.totals.pendingExpense;
  const cashBalance = sector ? sector.cash : finance.totals.cash;

  const base = sectors[0]?.series || [];
  const series = sector
    ? sector.series
    : base.map((point, i) => ({
        month: point.month,
        receitas: sectors.reduce((s, x) => s + (x.series[i]?.receitas || 0), 0),
        despesas: sectors.reduce((s, x) => s + (x.series[i]?.despesas || 0), 0),
        saldo: sectors.reduce((s, x) => s + (x.series[i]?.saldo || 0), 0),
      }));

  const comparison = sectors.map((s) => ({
    name: s.label,
    slug: s.slug,
    receitas: s.revenue,
    despesas: s.expense,
  }));

  const pieData = sectors.filter((s) => s.revenue > 0).map((s) => ({
    name: s.label,
    slug: s.slug,
    value: s.revenue,
  }));

  return (
    <>
      <PageHeader
        dot="bg-brand"
        title="Faturação por Setor"
        subtitle={periodLabel(preset, range)}
        action={
          <PeriodPicker preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />
        }
      />

      <div className="p-6 space-y-5 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {[{ slug: "todos", label: "Todos os setores" }, ...sectors].map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => setTab(s.slug)}
              className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] rounded-md ring-1 transition-colors ${
                tab === s.slug
                  ? "bg-brand text-primary-foreground ring-brand"
                  : "text-muted-foreground ring-edge hover:bg-white/5"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Kpi label="Receitas do período" value={formatMoney(revenue)} tone="text-warning" />
          <Kpi label="Despesas do período" value={formatMoney(expense)} tone="text-destructive" />
          <CashBalanceCard total={cashBalance + bankTotal} cash={cashBalance} bank={bankTotal} className="sm:col-span-2 lg:col-span-2" />
          <Kpi label="Despesas por pagar" value={formatMoney(pending)} tone="text-warning" />
        </div>

        <Card title="Depositar no banco">
          <div className="p-5 flex flex-wrap items-end gap-3">
            <p className="w-full text-xs text-muted-foreground">
              O valor sai do saldo de caixa (numerário) e entra no saldo via banco (VB). Não altera receitas nem despesas.
              Disponível em caixa neste setor: <span className="text-success font-semibold">{formatMoney(availableCash)}</span>.
            </p>
            <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Setor
              <select value={depSector} onChange={(e) => setDepSector(e.target.value)} className={`${inputClass} mt-1.5`}>
                {sectors.map((s) => (
                  <option key={s.slug} value={s.slug}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Valor (Kz)
              <input type="number" step="any" min={1} value={depAmount} onChange={(e) => setDepAmount(e.target.value)} className={`${inputClass} mt-1.5`} />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={deposit}
              className="px-4 py-2 rounded-md bg-brand text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "A registar…" : "Depositar"}
            </button>
          </div>
        </Card>

        <Card title={finance.granularity === "day" ? "Evolução diária" : "Evolução mensal"}>
          <div className="p-5 h-72">
            {isPending ? (
              <p className="text-sm text-muted-foreground">A carregar…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series}>
                  <defs>
                    <linearGradient id="fatRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--warning)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fatExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} width={70} />
                  <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="receitas"
                    name="Receitas"
                    stroke="var(--warning)"
                    strokeWidth={2}
                    fill="url(#fatRev)"
                  />
                  <Area
                    type="monotone"
                    dataKey="despesas"
                    name="Despesas"
                    stroke="var(--destructive)"
                    strokeWidth={2}
                    fill="url(#fatExp)"
                  />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    name="Saldo"
                    stroke="var(--success)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {tab === "todos" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <Card title="Comparação entre setores">
                <div className="p-5 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparison}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} width={70} />
                      <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={chartTooltip} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                       <Bar dataKey="receitas" name="Receitas" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                      <Bar
                        dataKey="despesas"
                        name="Despesas"
                        fill="var(--destructive)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
            <Card title="Peso de cada setor">
              <div className="p-5 h-72">
                {pieData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem receitas neste período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                        {pieData.map((p) => (
                          <Cell key={p.slug} fill={SECTOR_COLORS[p.slug] || "var(--brand)"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={chartTooltip} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        ) : null}

        <Card title="Caixa por setor">
          <table className="w-full text-sm">
            <thead className="bg-ink/60 text-left">
              <tr>
                <Th>Setor</Th>
                <Th>Receitas</Th>
                <Th>Saldo VB (banco)</Th>
                <Th>Numerário</Th>
                <Th>Despesas</Th>
                <Th>Por pagar</Th>
                <Th>Saldo caixa</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {sectors.map((s) => (
                <tr key={s.slug} className="hover:bg-white/5">
                  <Td className="font-medium">{s.label}</Td>
                   <Td className="text-warning">{formatMoney(s.revenue)}</Td>
                  <Td className="text-brand">{formatMoney(s.bank)}</Td>
                  <Td className="text-muted-foreground">{formatMoney(s.revenue - s.bankRevenue)}</Td>
                  <Td className="text-destructive">{formatMoney(s.expense)}</Td>
                  <Td className="text-warning">{formatMoney(s.pendingExpense)}</Td>
                  <Td
                    className={
                       s.cash >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"
                    }
                  >
                    {formatMoney(s.cash)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Movimentos do período">
          <table className="w-full text-sm">
            <thead className="bg-ink/60 text-left">
              <tr>
                <Th>Data</Th>
                <Th>Descrição</Th>
                <Th>Tipo</Th>
                <Th>Estado</Th>
                <Th>Valor</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {entries.slice(0, 60).map((e, i) => (
                <tr key={`${e.date}-${i}`} className="hover:bg-white/5">
                  <Td>{new Date(e.date).toLocaleDateString("pt-AO")}</Td>
                  <Td>
                    {e.description}
                    {e.payment === "Banco" || e.kind === "deposito" ? <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand/15 text-brand">VB</span> : null}
                    {e.pending ? <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning">No aparelho</span> : null}
                  </Td>
                  <Td>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${
                        e.kind === "receita"
                           ? "bg-warning/15 text-warning"
                          : e.kind === "deposito"
                            ? "bg-brand/15 text-brand"
                            : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {e.kind}
                    </span>
                  </Td>
                  <Td className="text-muted-foreground">{e.status}</Td>
                   <Td className={e.kind === "receita" ? "text-warning" : e.kind === "deposito" ? "text-brand" : "text-destructive"}>
                    {e.kind === "receita" ? "+" : e.kind === "deposito" ? "⇄ " : "−"}
                    {formatMoney(e.amount)}
                  </Td>
                  <Td>
                    {e.kind === "deposito" && e.id ? (
                      <button type="button" onClick={() => removeDeposit(e.id!)} className="text-xs text-destructive hover:underline">
                        Apagar
                      </button>
                    ) : null}
                  </Td>
                </tr>
              ))}
              {entries.length === 0 ? (
                <tr>
                  <Td className="text-muted-foreground">Sem movimentos neste período.</Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
