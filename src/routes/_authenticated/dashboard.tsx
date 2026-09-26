import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Droplets, Bus, Car, UtensilsCrossed, Wallet, Building2 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getFinance } from "@/lib/finance.functions";
import { periodLabel } from "@/lib/period";
import { Card, PageHeader, PeriodPicker, formatMoney, usePeriod } from "@/components/panel";
import { chartTooltip } from "@/components/sector-cash";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel Geral — Bofil" },
      { name: "description", content: "Receitas, despesas e saldo de todos os setores da empresa." },
      { property: "og:title", content: "Painel Geral — Bofil" },
      { property: "og:description", content: "Receitas, despesas e saldo de todos os setores da empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const META: Record<string, { color: string; bg: string; icon: typeof Droplets }> = {
  agua: { color: "var(--water)", bg: "bg-water", icon: Droplets },
  restaurante: { color: "var(--restaurant)", bg: "bg-restaurant", icon: UtensilsCrossed },
  lavagem: { color: "var(--wash)", bg: "bg-wash", icon: Car },
  transporte: { color: "var(--transport)", bg: "bg-transport", icon: Bus },
  geral: { color: "var(--brand)", bg: "bg-brand", icon: Building2 },
};

function DashboardPage() {
  const { preset, setPreset, custom, setCustom, range } = usePeriod("mes");
  const { data } = useQuery({
    queryKey: ["finance", range.from, range.to],
    queryFn: () => getFinance({ data: range }),
  });

  const sectors = data?.sectors || [];
  const totals = data?.totals || { revenue: 0, expense: 0, balance: 0, pendingExpense: 0 };
  const series = (sectors[0]?.series || []).map((row, i) => ({
    month: row.month,
    receitas: sectors.reduce((s, x) => s + (x.series[i]?.receitas || 0), 0),
    despesas: sectors.reduce((s, x) => s + (x.series[i]?.despesas || 0), 0),
  }));
  const bars = sectors.map((s) => ({ name: s.label.split(" ")[0], Receitas: s.revenue, Despesas: s.expense, Saldo: s.balance }));
  const pie = sectors.filter((s) => s.revenue > 0).map((s) => ({ name: s.label, value: s.revenue, slug: s.slug }));

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <PageHeader
        dot="bg-brand"
        title="Painel geral"
        subtitle={periodLabel(preset, range)}
        action={<PeriodPicker preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />}
      />
      <div className="flex-1 overflow-auto p-6 space-y-5">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Big label="Receitas totais" value={totals.revenue} tone="text-warning" icon={<ArrowUpRight className="size-4 text-warning" />} />
          <Big label="Despesas totais" value={totals.expense} tone="text-destructive" icon={<ArrowDownRight className="size-4 text-destructive" />} />
          <Big
            label="Saldo global"
            value={totals.balance}
            tone={totals.balance >= 0 ? "text-success" : "text-destructive"}
            icon={<Wallet className="size-4 text-success" />}
            highlight
          />
          <Big label="Por pagar" value={totals.pendingExpense} tone="text-warning" />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {sectors.map((s) => {
            const m = META[s.slug] ?? META["geral"]!;
            const Icon = m.icon;
            return (
              <div key={s.slug} className="relative overflow-hidden rounded-xl bg-panel ring-1 ring-edge p-4">
                <span className={`absolute inset-x-0 top-0 h-1 ${m.bg}`} />
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-4" style={{ color: m.color }} /> {s.label}
                </div>
                <dl className="mt-3 space-y-1 text-xs">
                   <Row k="Receitas" v={s.revenue} tone="text-warning" />
                  <Row k="Despesas" v={s.expense} tone="text-destructive" />
                </dl>
                 <p className={`mt-3 font-display text-2xl ${s.balance >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatMoney(s.balance)}
                </p>
              </div>
            );
          })}
        </section>

        <Card title="Evolução da empresa">
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="d-in" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--warning)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="d-out" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} width={70} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="receitas" name="Receitas" stroke="var(--warning)" strokeWidth={2.5} fill="url(#d-in)" />
                <Area type="monotone" dataKey="despesas" name="Despesas" stroke="var(--destructive)" strokeWidth={2.5} fill="url(#d-out)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <Card title="Comparação por setor">
              <div className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bars} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} width={70} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={chartTooltip} cursor={{ fill: "color-mix(in oklch, var(--edge) 40%, transparent)" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                     <Bar dataKey="Receitas" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Despesas" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                     <Bar dataKey="Saldo" fill="var(--success)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <Card title="Peso de cada setor">
            <div className="h-72 p-4">
              {pie.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Ainda sem receitas neste período.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">
                      {pie.map((p) => (
                        <Cell key={p.slug} fill={META[p.slug]?.color ?? "var(--brand)"} />
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
      </div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: number; tone: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={tone}>{formatMoney(v)}</dd>
    </div>
  );
}

function Big({
  label,
  value,
  tone,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  tone: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-5 ring-1 ${highlight ? "bg-success/10 ring-success/40" : "bg-panel ring-edge"}`}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label} {icon}
      </div>
      <p className={`mt-2 font-display text-3xl ${tone}`}>
        {formatMoney(value)}
      </p>
    </div>
  );
}
