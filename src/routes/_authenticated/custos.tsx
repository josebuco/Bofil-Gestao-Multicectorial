import { todayAngola } from "@/lib/tz";
import { sendOrQueue, useQueue } from "@/lib/offline";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { STOCK_CATEGORY, addCategory, listCategories } from "@/lib/rental.functions";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  SECTORS,
  getExpenses,
  createExpense,
  deleteExpense,
  getInvoiceUrl,
  markExpensePaid,
} from "@/lib/expenses.functions";
import { PeriodPicker, usePeriod } from "@/components/panel";
import { useAccess } from "@/lib/use-access";
import { periodLabel } from "@/lib/period";

const expensesOptions = queryOptions({
  queryKey: ["expenses"],
  queryFn: () => getExpenses(),
});

export const Route = createFileRoute("/_authenticated/custos")({
  head: () => ({
    meta: [
      { title: "Centro de Custos — Bofil" },
      {
        name: "description",
        content: "Registo de despesas por setor com descrição e fatura anexada.",
      },
      { property: "og:title", content: "Centro de Custos — Bofil" },
      { property: "og:description", content: "Registo de despesas por setor com descrição e fatura anexada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    // Sem internet, segue com a cópia guardada no aparelho.
    await context.queryClient.ensureQueryData(expensesOptions).catch(() => null);
  },
  component: CustosPage,
});

function formatMoney(value: number) {
  return value.toLocaleString("pt-AO");
}

const CATEGORIES = [
  "Manutenção e Reparação",
  "Subsídio de Alimentação",
  "Energia",
  "Casa",
  "Combustível",
  "Salários",
  "Compras / Stock",
  "Impostos",
  "Outros",
];

function CustosPage() {
  const { data } = useSuspenseQuery(expensesOptions);
  const queuedExpenses = useQueue("expense").map((item) => ({
    id: item.id,
    sector: String(item.data["sector"]),
    category: String(item.data["category"] || "Geral"),
    description: String(item.data["description"] || "Despesa"),
    amount: Number(item.data["amount"]) || 0,
    expense_date: String(item.data["expense_date"] || item.at.slice(0, 10)),
    supplier: (item.data["supplier"] as string | null) ?? null,
    status: String(item.data["status"] || "Pendente"),
    invoice_path: null as string | null,
    notes: (item.data["notes"] as string | null) ?? null,
    payment_method: String(item.data["payment_method"] || "Numerário"),
    created_by: null,
    created_at: item.at,
    updated_at: item.at,
    pending: true,
  }));
  const allExpenses = [
    ...queuedExpenses,
    ...data.expenses.map((expense) => ({ ...expense, pending: false })),
  ];
  const queryClient = useQueryClient();
  const access = useAccess();
  const extraCats = useQuery({ queryKey: ["expense-categories"], queryFn: () => listCategories() });
  const categories = Array.from(new Set([...CATEGORIES.filter((c) => c !== "Outros"), ...(extraCats.data || []), "Outros"]));
  async function newCategory() {
    const name = window.prompt("Nome da nova categoria de custo:")?.trim();
    if (!name) return;
    try {
      await addCategory({ data: { name } });
      await queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success(`Categoria "${name}" criada.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar (precisa de internet).");
    }
  }
  const [rawTab, setTab] = useState<string>("agua");
  const allowedSlugs = SECTORS.filter((s) => access.isAdmin || access.sectors.includes(s.slug)).map((s) => s.slug as string);
  const tab = allowedSlugs.includes(rawTab) ? rawTab : (allowedSlugs[0] ?? rawTab);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  const { preset, setPreset, custom, setCustom, range } = usePeriod("mes");

  const inRange = allExpenses.filter(
    (e) => e.expense_date >= range.from && e.expense_date <= range.to,
  );
  const periodBySector: Record<string, number> = {};
  for (const e of inRange) {
    periodBySector[e.sector] = (periodBySector[e.sector] || 0) + (e.amount || 0);
  }
  const periodTotal = inRange.reduce((s, e) => s + (e.amount || 0), 0);
  const periodPending = inRange
    .filter((e) => e.status === "Pendente")
    .reduce((s, e) => s + (e.amount || 0), 0);

  const rows = inRange.filter((e) => e.sector === tab);
  const tabTotal = rows.reduce((s, e) => s + (e.amount || 0), 0);
  const tabPending = rows
    .filter((e) => e.status === "Pendente")
    .reduce((s, e) => s + (e.amount || 0), 0);

  async function openInvoice(path: string) {
    try {
      const { url } = await getInvoiceUrl({ data: { path } });
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Não foi possível abrir a fatura.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      let invoicePath: string | null = null;
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (file && !offline) {
        const ext = file.name.split(".").pop() || "pdf";
        const path = `${tab}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("faturas").upload(path, file);
        if (error) throw new Error(error.message);
        invoicePath = path;
      }

      const isRental = tab === "aluguer";
      const payload = {
        sector: tab,
        category: isRental ? STOCK_CATEGORY : String(form.get("category") || "Outros"),
        quantity: isRental ? Math.max(1, Number(form.get("quantity") || 1)) : null,
        description: String(form.get("description") || ""),
        amount: Number(form.get("amount") || 0),
        expense_date: String(form.get("expense_date") || ""),
        supplier: (String(form.get("supplier") || "").trim() || null) as string | null,
        status: String(form.get("status") || "Pendente"),
        invoice_path: invoicePath,
        notes: (String(form.get("notes") || "").trim() || null) as string | null,
        payment_method: (form.get("payment_method") === "Banco" ? "Banco" : "Numerário") as "Banco" | "Numerário",
      };
      const r = await sendOrQueue("expense", payload, `Despesa: ${payload.description}`, () => createExpense({ data: payload }));

      if (r === "queued")
        toast.success(file ? "Sem internet: despesa guardada no aparelho (anexe a fatura depois)." : "Sem internet: despesa guardada no aparelho.");
      else toast.success("Despesa registada.");
      setOpen(false);
      setFile(null);
      if (r === "sent") await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao guardar a despesa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteExpense({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Despesa removida.");
    } catch {
      toast.error("Não foi possível remover.");
    }
  }

  const inputClass =
    "w-full rounded-md bg-ink ring-1 ring-edge px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-primary";

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="min-h-16 shrink-0 bg-panel/80 border-b border-edge flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div>
          <h1 className="font-display font-semibold text-lg uppercase tracking-wide text-foreground">
            Centro de Custos
          </h1>
          <p className="text-[11px] text-muted-foreground">{periodLabel(preset, range)}</p>
        </div>
        <PeriodPicker preset={preset} setPreset={setPreset} custom={custom} setCustom={setCustom} />
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-1.5 text-sm font-medium text-primary-foreground bg-brand rounded-md hover:bg-brand/90"
        >
          {open ? "Fechar" : "+ Nova despesa"}
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <section className={`grid grid-cols-1 gap-3 ${access.isAdmin ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <div className="rounded-lg bg-panel ring-1 ring-black/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Despesas do período
            </p>
            <p className="font-display font-semibold text-2xl text-foreground mt-2">
              {formatMoney(periodTotal)} Kz
            </p>
          </div>
          <div className="rounded-lg bg-panel ring-1 ring-black/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Por pagar no período
            </p>
            <p className="font-display font-semibold text-2xl text-warning mt-2">
              {formatMoney(periodPending)} Kz
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-1 border-b border-edge">
          {SECTORS.filter((s) => access.isAdmin || access.sectors.includes(s.slug)).map((s) => (
            <button
              key={s.slug}
              onClick={() => setTab(s.slug)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === s.slug
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`size-1.5 rounded-full ${s.color}`} />
              {s.label}
              <span className="text-[11px] text-muted-foreground">
                {formatMoney(periodBySector[s.slug] || 0)} Kz
              </span>
            </button>
          ))}
        </div>

        {open && (
          <form
            onSubmit={handleSubmit}
            className="rounded-lg bg-panel ring-1 ring-black/5 p-5 grid grid-cols-1 md:grid-cols-3 gap-3"
          >
            <div className="md:col-span-3">
              <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Descrição da despesa
              </label>
              <input
                name="description"
                required
                placeholder="Ex.: Compra de 200 garrafões de 20L"
                className={`${inputClass} mt-1.5`}
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Valor (Kz)
              </label>
              <input
                name="amount"
                type="number"
                min="0"
                required
                className={`${inputClass} mt-1.5`}
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Data
              </label>
              <input
                name="expense_date"
                type="date"
                required
                defaultValue={todayAngola()}
                className={`${inputClass} mt-1.5`}
              />
            </div>
            {tab === "aluguer" ? (
              <>
                <div>
                  <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Categoria
                  </label>
                  <div className={`${inputClass} mt-1.5 flex items-center justify-between`}>
                    <span>{STOCK_CATEGORY}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">única</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Quantidade comprada
                  </label>
                  <input name="quantity" type="number" min="1" defaultValue={1} required className={`${inputClass} mt-1.5`} />
                </div>
              </>
            ) : (
              <div>
                <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground flex justify-between">
                  Categoria
                  <button type="button" onClick={newCategory} className="normal-case tracking-normal text-primary hover:underline">
                    + Nova categoria
                  </button>
                </label>
                <select name="category" className={`${inputClass} mt-1.5`}>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Fornecedor
              </label>
              <input name="supplier" className={`${inputClass} mt-1.5`} />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Estado
              </label>
              <select name="status" className={`${inputClass} mt-1.5`}>
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Pagamento
              </label>
              <select name="payment_method" className={`${inputClass} mt-1.5`}>
                <option value="Numerário">Numerário (caixa)</option>
                <option value="Banco">Banco (VB)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Fatura (PDF ou foto)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className={`${inputClass} mt-1.5 file:mr-3 file:rounded file:border-0 file:bg-edge file:px-2 file:py-1 file:text-xs file:text-foreground`}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Notas
              </label>
              <input name="notes" className={`${inputClass} mt-1.5`} />
            </div>
            <div className="md:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full px-3 py-2 text-sm font-medium text-primary-foreground bg-brand rounded-md hover:bg-brand/90 disabled:opacity-60"
              >
                {saving ? "A guardar..." : "Guardar despesa"}
              </button>
            </div>
          </form>
        )}

        <div className="rounded-lg bg-panel ring-1 ring-black/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-base uppercase tracking-wide text-foreground">
              Despesas — {SECTORS.find((s) => s.slug === tab)?.label}
            </h2>
            <p className="text-xs text-muted-foreground">
              Total {formatMoney(tabTotal)} Kz · Por pagar{" "}
              <span className="text-warning">{formatMoney(tabPending)} Kz</span>
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Ainda não há despesas registadas neste setor.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground border-b border-edge text-left">
                    <th className="px-3 py-2.5">Data</th>
                    <th className="px-3 py-2.5">Descrição</th>
                    <th className="px-3 py-2.5">Categoria</th>
                    <th className="px-3 py-2.5">Fornecedor</th>
                    <th className="px-3 py-2.5">Valor</th>
                    <th className="px-3 py-2.5">Estado</th>
                    <th className="px-3 py-2.5">Fatura</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge/60">
                  {rows.map((e) => (
                    <tr key={e.id} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(e.expense_date).toLocaleDateString("pt-AO")}
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        {e.description}
                        {e.notes && (
                          <span className="block text-[11px] text-muted-foreground">{e.notes}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{e.category}</td>
                      <td className="px-3 py-3 text-muted-foreground">{e.supplier || "—"}</td>
                      <td className="px-3 py-3 text-foreground/80 whitespace-nowrap">
                        {formatMoney(e.amount)} Kz
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs font-medium ${
                            e.status === "Pago" ? "text-success" : "text-warning"
                          }`}
                        >
                          {e.status}
                        </span>
                        {e.pending ? (
                          <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning">
                            No aparelho
                          </span>
                        ) : null}
                        {e.status === "Pendente" && !e.pending ? (
                          <button
                            onClick={() => setPaying(paying === e.id ? null : e.id)}
                            className="ml-2 text-xs font-medium text-primary hover:underline"
                          >
                            Marcar pago
                          </button>
                        ) : null}
                        {paying === e.id ? (
                          <PayForm
                            id={e.id}
                            sector={e.sector}
                            onDone={async () => {
                              setPaying(null);
                              await queryClient.invalidateQueries({ queryKey: ["expenses"] });
                            }}
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        {e.invoice_path && !e.pending ? (
                          <button
                            onClick={() => {
                              if (e.invoice_path) void openInvoice(e.invoice_path);
                            }}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Ver fatura
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem fatura</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {access.isAdmin && !e.pending ? (
                          <button
                            onClick={() => {
                              if (confirm("Apagar esta despesa?")) void handleDelete(e.id);
                            }}
                            className="text-xs text-muted-foreground hover:text-destructive"
                          >
                            Apagar
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PayForm({ id, sector, onDone }: { id: string; sector: string; onDone: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      let invoicePath: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "pdf";
        const path = `${sector}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("faturas").upload(path, file);
        if (error) throw new Error(error.message);
        invoicePath = path;
      }
      await markExpensePaid({ data: { id, invoice_path: invoicePath, notes: notes.trim() || null } });
      toast.success("Despesa marcada como paga.");
      await onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar o pagamento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 w-64 space-y-2 rounded-md bg-ink ring-1 ring-edge p-3">
      <label className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Fatura (opcional)
      </label>
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full text-xs text-foreground file:mr-2 file:rounded file:border-0 file:bg-edge file:px-2 file:py-1 file:text-xs file:text-foreground"
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Nota (ex.: pago por transferência)"
        className="w-full rounded-md bg-panel ring-1 ring-edge px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      <button
        onClick={() => void confirm()}
        disabled={busy}
        className="w-full rounded-md bg-brand px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-brand/90 disabled:opacity-60"
      >
        {busy ? "A guardar..." : "Confirmar pagamento"}
      </button>
    </div>
  );
}
