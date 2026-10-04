import { useState, type ReactNode } from "react";
import { Banknote, ChevronDown, Landmark, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PERIOD_OPTIONS, resolvePeriod, type PeriodPreset } from "@/lib/period";
import { useAccess } from "@/lib/use-access";

export function usePeriod(initial: PeriodPreset = "mes") {
  const [preset, setPreset] = useState<PeriodPreset>(initial);
  const [custom, setCustom] = useState(() => resolvePeriod("mes"));
  const { isAdmin } = useAccess();
  if (!isAdmin) {
    return { preset: "hoje" as PeriodPreset, setPreset, custom, setCustom, range: resolvePeriod("hoje") };
  }
  const range = preset === "personalizado" ? custom : resolvePeriod(preset);
  return { preset, setPreset, custom, setCustom, range };
}

export function PeriodPicker({
  preset,
  setPreset,
  custom,
  setCustom,
}: {
  preset: PeriodPreset;
  setPreset: (p: PeriodPreset) => void;
  custom: { from: string; to: string };
  setCustom: (r: { from: string; to: string }) => void;
}) {
  const { isAdmin } = useAccess();
  if (!isAdmin) {
    return (
      <span className="px-2.5 py-1 text-xs rounded-md bg-ink ring-1 ring-edge text-muted-foreground">
        Hoje — acesso diário
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center rounded-md bg-ink ring-1 ring-edge p-0.5">
        {PERIOD_OPTIONS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              preset === p.id
                ? "bg-brand font-medium text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "personalizado" ? (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={custom.from}
            onChange={(e) => setCustom({ ...custom, from: e.target.value })}
            className="rounded-md bg-ink ring-1 ring-edge px-2 py-1 text-xs text-foreground"
          />
          <span className="text-xs text-muted-foreground">a</span>
          <input
            type="date"
            value={custom.to}
            onChange={(e) => setCustom({ ...custom, to: e.target.value })}
            className="rounded-md bg-ink ring-1 ring-edge px-2 py-1 text-xs text-foreground"
          />
        </div>
      ) : null}
    </div>
  );
}

export function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("pt-AO")} Kz`;
}

export const inputClass =
  "w-full rounded-md bg-ink ring-1 ring-edge px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-primary";

export function PageHeader({
  dot,
  title,
  subtitle,
  action,
}: {
  dot?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <header className="min-h-16 shrink-0 bg-panel/80 border-b border-edge flex flex-wrap items-center justify-between gap-3 px-6 py-3">
      <div>
        <h1 className="font-display font-semibold text-lg uppercase tracking-wide text-foreground inline-flex items-center gap-2">
          {dot ? <span className={`size-2 rounded-full ${dot}`} /> : null}
          {title}
        </h1>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

export function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl bg-panel ring-1 ring-edge p-4 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`font-display font-semibold text-2xl mt-2 ${tone || "text-foreground"}`}>{value}</p>
    </div>
  );
}

export function CashBalanceCard({
  total,
  cash,
  bank,
  className,
}: {
  total: number;
  cash: number;
  bank: number;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-success/10 ring-1 ring-success/40 p-5 shadow-sm ${className || ""}`}>
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted-foreground">
        Saldo total do período <Wallet className="size-4 text-success" />
      </div>
      <p className={`mt-2 font-display text-3xl font-semibold ${total >= 0 ? "text-success" : "text-destructive"}`}>
        {formatMoney(total)}
      </p>
      <div className="mt-4 grid grid-cols-2 divide-x divide-success/25 border-t border-success/25 pt-3">
        <div className="pr-3 min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <Banknote className="size-3.5 shrink-0" /> Numerário
          </p>
          <p className={`mt-1 font-display text-lg font-semibold break-words ${cash >= 0 ? "text-success" : "text-destructive"}`}>
            {formatMoney(cash)}
          </p>
        </div>
        <div className="pl-3 min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <Landmark className="size-3.5 shrink-0" /> Banco
          </p>
          <p className={`mt-1 font-display text-lg font-semibold break-words ${bank >= 0 ? "text-success" : "text-destructive"}`}>
            {formatMoney(bank)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-panel ring-1 ring-edge overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-edge bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between gap-3">
        <h2 className="font-display font-semibold text-base uppercase tracking-wide text-foreground flex items-center gap-2"><span className="h-4 w-1 rounded-full bg-primary" />{title}</h2>
        {action}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function ExpandableCard({
  title,
  summary,
  action,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg bg-panel ring-1 ring-edge overflow-hidden shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="min-w-0 text-left"
        >
          <span className="min-w-0">
            <span className="block truncate font-display font-semibold text-sm uppercase tracking-wide text-foreground">{title}</span>
            {summary ? <span className="block truncate text-[11px] text-muted-foreground">{summary}</span> : null}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <Button type="button" variant="ghost" size="icon" onClick={() => setOpen((value) => !value)} aria-label={open ? `Fechar ${title}` : `Abrir ${title}`}>
            <ChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </div>
      {open ? <div className="border-t border-edge overflow-x-auto">{children}</div> : null}
    </section>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="px-4 py-2.5 text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">{children}</th>;
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-foreground/85 ${className || ""}`}>{children}</td>;
}

export function FormPanel({
  open,
  title,
  saving,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  saving: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg bg-panel ring-1 ring-black/5 p-5 space-y-4"
    >
      <h2 className="font-display font-semibold text-base uppercase tracking-wide text-foreground flex items-center gap-2"><span className="h-4 w-1 rounded-full bg-primary" />{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 text-sm font-medium text-primary-foreground bg-brand rounded-md hover:bg-brand/90 disabled:opacity-60"
      >
        {saving ? "A guardar..." : "Guardar"}
      </button>
    </form>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function ActionButton({
  onClick,
  children,
  tone,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-md ring-1 ring-edge hover:bg-white/5 ${tone || "text-muted-foreground"}`}
    >
      {children}
    </button>
  );
}
