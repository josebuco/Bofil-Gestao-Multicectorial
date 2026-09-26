import { todayAngola } from "@/lib/tz";
export type PeriodPreset =
  | "hoje"
  | "7dias"
  | "30dias"
  | "mes"
  | "mes_passado"
  | "3meses"
  | "6meses"
  | "ano"
  | "personalizado";

export const PERIOD_OPTIONS: Array<{ id: PeriodPreset; label: string }> = [
  { id: "hoje", label: "Hoje" },
  { id: "7dias", label: "7 dias" },
  { id: "30dias", label: "30 dias" },
  { id: "mes", label: "Mês actual" },
  { id: "mes_passado", label: "Mês passado" },
  { id: "3meses", label: "3 meses" },
  { id: "6meses", label: "6 meses" },
  { id: "ano", label: "Este ano" },
  { id: "personalizado", label: "Personalizado" },
];

function iso(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function resolvePeriod(preset: PeriodPreset, custom?: { from: string; to: string }) {
  // Angola calendar date (UTC+1), independent of device/server timezone.
  const [ay, am, ad] = todayAngola().split("-").map(Number);
  const now = new Date(ay!, am! - 1, ad!);
  const to = iso(now);
  switch (preset) {
    case "hoje":
      return { from: to, to };
    case "7dias": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: iso(d), to };
    }
    case "30dias": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: iso(d), to };
    }
    case "mes": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: iso(d), to };
    }
    case "mes_passado": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: iso(start), to: iso(end) };
    }
    case "3meses": {
      const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { from: iso(d), to };
    }
    case "6meses": {
      const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { from: iso(d), to };
    }
    case "ano": {
      const d = new Date(now.getFullYear(), 0, 1);
      return { from: iso(d), to };
    }
    case "personalizado":
    default:
      return {
        from: custom?.from || iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: custom?.to || to,
      };
  }
}

export function periodLabel(preset: PeriodPreset, range: { from: string; to: string }) {
  const found = PERIOD_OPTIONS.find((p) => p.id === preset);
  const fmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("pt-AO");
  return `${found?.label || "Período"} · ${fmt(range.from)} a ${fmt(range.to)}`;
}
