import { useQuery } from "@tanstack/react-query";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getFinance } from "@/lib/finance.functions";
import { periodLabel } from "@/lib/period";
import { Card, CashBalanceCard, Kpi, PeriodPicker, formatMoney, usePeriod } from "@/components/panel";
import { useMergedFinance } from "@/lib/offline-finance";
import { useAccess } from "@/lib/use-access";

export const chartTooltip = {
  background: "var(--panel)",
  border: "1px solid var(--edge)",
  borderRadius: 8,
  fontSize: 12,
} as const;

export function SectorCash({ slug }: { slug: string }) {
  const { preset, setPreset, custom, setCustom, range } = usePeriod("mes");

  const { data } = useQuery({
    queryKey: ["finance", range.from, range.to],
    queryFn: () => getFinance({ data: range }),
  });

  const finance = useMergedFinance(data, range);
  const { isAdmin } = useAccess();
  const sector = finance.sectors.find((s) => s.slug === slug);

  return (
    <Card
      title="Caixa do setor"
      action={
        <PeriodPicker preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />
      }
    >
      <div className="p-5 space-y-4">
        <p className="text-[11px] text-muted-foreground">{periodLabel(preset, range)}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Receitas" value={formatMoney(sector?.revenue || 0)} tone="text-warning" />
          {isAdmin && <Kpi label="Despesas" value={formatMoney(sector?.expense || 0)} tone="text-destructive" />}
          <CashBalanceCard
            total={sector?.balance || 0}
            cash={sector?.cash || 0}
            bank={sector?.bank || 0}
            className={isAdmin ? "lg:col-span-1" : "sm:col-span-1 lg:col-span-2"}
          />
          {isAdmin && <Kpi label="Por pagar" value={formatMoney(sector?.pendingExpense || 0)} tone="text-warning" />}
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={sector?.series || []}>
              <defs>
                <linearGradient id={`rev-${slug}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--warning)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`exp-${slug}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.4} />
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
                fill={`url(#rev-${slug})`}
              />
              <Area
                type="monotone"
                dataKey="despesas"
                name="Despesas"
                stroke="var(--destructive)"
                strokeWidth={2}
                fill={`url(#exp-${slug})`}
              />
              <Line
                type="monotone"
                dataKey="saldo"
                name="Saldo"
                stroke="var(--success)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
