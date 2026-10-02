import { createFileRoute } from "@tanstack/react-router";
import { FleetPage } from "@/components/fleet-page";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { sendOrQueue, useQueue } from "@/lib/offline";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getWaterData } from "@/lib/sectors.functions";
import {
  createWaterProduct,
  createWaterSale,
  deleteRecord,
  updateWaterSaleStatus,
} from "@/lib/crud.functions";
import {
  ActionButton,
  Card,
  Field,
  FormPanel,
  Kpi,
  PageHeader,
  Td,
  Th,
  formatMoney,
  inputClass,
} from "@/components/panel";
import { SectorCash } from "@/components/sector-cash";
import { useAccess } from "@/lib/use-access";
import { dayStartIso, todayAngola } from "@/lib/tz";

const waterOptions = queryOptions({
  queryKey: ["sector", "agua"],
  queryFn: () => getWaterData(),
});

export const Route = createFileRoute("/_authenticated/agua")({
  head: () => ({
    meta: [
      { title: "Estação de Água — Bofil" },
      { name: "description", content: "Gestão de entregas de água com camião cisterna." },
      { property: "og:title", content: "Estação de Água — Bofil" },
      { property: "og:description", content: "Gestão de entregas de água com camião cisterna." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    // Sem internet, segue com a cópia guardada no aparelho.
    await context.queryClient.ensureQueryData(waterOptions).catch(() => null);
  },
  component: AguaPage,
});

function AguaPage() {
  const { data } = useSuspenseQuery(waterOptions);
  const qc = useQueryClient();
  const addSale = useServerFn(createWaterSale);
  const addProduct = useServerFn(createWaterProduct);
  const setStatus = useServerFn(updateWaterSaleStatus);
  const removeRecord = useServerFn(deleteRecord);
  const { isAdmin } = useAccess();

  const [form, setForm] = useState<"none" | "sale" | "product">("none");
  const [saving, setSaving] = useState(false);

  const [today, setToday] = useState(todayAngola());
  useEffect(() => {
    const t = setInterval(() => {
      const d = todayAngola();
      if (d !== today) {
        setToday(d);
        void qc.invalidateQueries();
      }
    }, 30000);
    return () => clearInterval(t);
  }, [today, qc]);
  const dayStart = new Date(dayStartIso(today));
  // Técnico vê apenas as entregas do dia actual (Angola); a administração vê o histórico.
  const queuedSales = useQueue("water_sale").map((q) => {
    const p = data.products.find((x) => x.id === q.data["product_id"]);
    const qty = Number(q.data["quantity"]) || 0;
    return {
      id: q.id,
      created_at: q.at,
      quantity: qty,
      client_name: (q.data["client_name"] as string | null) ?? null,
      total: Number(q.data["offline_total"]) || (p?.price || 0) * qty,
      status: String(q.data["status"]),
      water_products: { name: (q.data["description"] as string) || p?.name || "Serviço" },
      pending: true,
    };
  });
  const queuedToday = queuedSales.filter((s) => new Date(s.created_at) >= dayStart);
  const visibleSales = [
    ...queuedSales,
    ...(isAdmin ? data.sales : data.sales.filter((s) => new Date(s.created_at) >= dayStart)).map((s) => ({ ...s, pending: false })),
  ];
  const pending = visibleSales.filter((s) => s.status === "Pendente").length;

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["sector", "agua"] });
    await qc.invalidateQueries({ queryKey: ["finance"] });
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
    await qc.invalidateQueries({ queryKey: ["truck-sales"] });
  }

  async function run(fn: () => Promise<unknown>, message: string) {
    setSaving(true);
    try {
      await fn();
      toast.success(message);
      setForm("none");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  function onSale(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      product_id: String(f.get("product_id")),
      quantity: Number(f.get("quantity")),
      client_name: String(f.get("client_name") || "").trim() || null,
      status: String(f.get("status")),
      payment_method: (f.get("payment_method") === "Banco" ? "Banco" : "Numerário") as "Banco" | "Numerário",
      ...(isAdmin && f.get("entry_date") ? { entry_date: String(f.get("entry_date")) } : {}),
      offline_total: (data.products.find((product) => product.id === String(f.get("product_id")))?.price || 0) * Number(f.get("quantity")),
    };
    let queued = false;
    void run(
      async () => {
        queued = (await sendOrQueue("water_sale", payload, `Água × ${payload.quantity}`, () => addSale({ data: payload }))) === "queued";
        if (queued) toast.info("Sem internet: venda guardada no aparelho. Envia ao sincronizar.");
      },
      "Venda registada.",
    );
  }

  function onProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(
      () =>
          addProduct({
            data: {
              name: String(f.get("name")),
              price: Number(f.get("price")),
              stock: 0,
              unit: String(f.get("unit")),
            },
          }),
        "Serviço criado.",
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <PageHeader
        dot="bg-water"
        title="Estação de Água"
        subtitle="Entregas com camião cisterna"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setForm(form === "product" ? "none" : "product")}
              className="px-3 py-1.5 text-sm font-medium rounded-md ring-1 ring-edge text-foreground hover:bg-white/5"
            >
              + Serviço
            </button>
            <button
              onClick={() => setForm(form === "sale" ? "none" : "sale")}
              className="px-3 py-1.5 text-sm font-medium text-primary-foreground bg-water rounded-md hover:bg-water/90"
            >
              + Nova venda
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <SectorCash slug="agua" />
        <section className="space-y-3">
          <h2 className="font-display text-lg uppercase tracking-wide text-foreground">Camiões e equipamentos</h2>
          <FleetPage sector="agua" title="Água" subtitle="" dot="bg-water" embedded />
        </section>
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
           <Kpi label="Receita hoje" value={formatMoney(data.todayRevenue + queuedToday.filter((s) => s.status !== "Pendente").reduce((t, s) => t + s.total, 0))} />
          <Kpi label="Entregas hoje" value={data.todaySalesCount + queuedToday.length} />
          <Kpi label="Entregas pendentes" value={pending} tone="text-warning" />
        </section>


        <FormPanel open={form === "sale"} title="Nova entrega" saving={saving} onSubmit={onSale}>
          <Field label="Serviço">
            <select name="product_id" required className={inputClass}>
              {data.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatMoney(p.price)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantidade">
            <input name="quantity" type="number" min={1} defaultValue={1} required className={inputClass} />
          </Field>
          <Field label="Cliente">
            <input name="client_name" placeholder="Opcional" className={inputClass} />
          </Field>
          {isAdmin ? (
            <Field label="Data (vazio = hoje)">
              <input name="entry_date" type="date" className={inputClass} />
            </Field>
          ) : null}
          <Field label="Estado">
            <select name="status" className={inputClass} defaultValue="Entregue">
              <option>Entregue</option>
              <option>Pendente</option>
            </select>
          </Field>
          <Field label="Pagamento">
            <select name="payment_method" className={inputClass} defaultValue="Numerário">
              <option value="Numerário">Numerário</option>
              <option value="Banco">Banco (VB)</option>
            </select>
          </Field>
        </FormPanel>

        <FormPanel open={form === "product"} title="Novo serviço" saving={saving} onSubmit={onProduct}>
          <Field label="Nome">
            <input name="name" required className={inputClass} placeholder="Cisterna 10.000L" />
          </Field>
          <Field label="Preço (Kz)">
            <input name="price" type="number" min={0} required className={inputClass} />
          </Field>
          <Field label="Unidade">
            <input name="unit" defaultValue="viagem" required className={inputClass} />
          </Field>
        </FormPanel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card title="Tabela de preços">
            <table className="w-full text-sm">
              <thead className="border-b border-edge text-left">
                <tr>
                  <Th>Serviço</Th>
                  <Th>Preço</Th>
                  {isAdmin ? <Th>Acção</Th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/60">
                {data.products.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <Td>{p.name}</Td>
                    <Td>
                      {formatMoney(p.price)}/{p.unit}
                    </Td>
                    {isAdmin ? (
                      <Td>
                        <ActionButton
                          onClick={() => {
                            if (confirm("Apagar este serviço?"))
                              void run(
                                () => removeRecord({ data: { table: "water_products", id: p.id } }),
                                "Serviço removido.",
                              );
                          }}
                        >
                          Apagar
                        </ActionButton>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Entregas recentes">
            <table className="w-full text-sm">
              <thead className="border-b border-edge text-left">
                <tr>
                  <Th>Data</Th>
                  <Th>Item</Th>
                  <Th>Cliente</Th>
                  <Th>Valor</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/60">
                {visibleSales.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <Td>{new Date(s.created_at).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" })}</Td>
                    <Td>
                      {("description" in s && s.description) || (s.water_products as unknown as { name: string } | null)?.name || "Serviço"} × {s.quantity}
                    </Td>
                    <Td>{s.client_name || "—"}</Td>
                    <Td>{formatMoney(s.total)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className={s.status === "Pendente" ? "text-warning" : "text-muted-foreground"}>
                          {s.status}
                        </span>
                        {s.pending ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning">No aparelho</span>
                        ) : null}
                        {s.status === "Pendente" && !s.pending ? (
                          <ActionButton
                            onClick={() =>
                              void run(
                                () => setStatus({ data: { id: s.id, status: "Entregue" } }),
                                "Entrega concluída.",
                              )
                            }
                          >
                            Entregar
                          </ActionButton>
                        ) : null}
                        {isAdmin && !s.pending ? (
                          <ActionButton
                            onClick={() => {
                              if (confirm("Apagar esta venda?"))
                                void run(
                                  () => removeRecord({ data: { table: "water_sales", id: s.id } }),
                                  "Venda apagada.",
                                );
                            }}
                          >
                            Apagar
                          </ActionButton>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}
