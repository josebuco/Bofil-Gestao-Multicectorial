import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
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
    await context.queryClient.ensureQueryData(waterOptions);
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

  const [form, setForm] = useState<"none" | "sale" | "product">("none");
  const [saving, setSaving] = useState(false);

  const pending = data.sales.filter((s) => s.status === "Pendente").length;

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["sector", "agua"] });
    await qc.invalidateQueries({ queryKey: ["finance"] });
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
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
    void run(
      () =>
        addSale({
          data: {
            product_id: String(f.get("product_id")),
            quantity: Number(f.get("quantity")),
            client_name: String(f.get("client_name") || "").trim() || null,
            status: String(f.get("status")),
          },
        }),
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
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Kpi label="Receita hoje" value={formatMoney(data.todayRevenue)} />
          <Kpi label="Entregas hoje" value={data.todaySalesCount} />
          <Kpi label="Entregas pendentes" value={pending} tone="text-warning" />
        </section>

        <SectorCash slug="agua" />

        <FormPanel open={form === "sale"} title="Nova venda" saving={saving} onSubmit={onSale}>
          <Field label="Produto">
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
          <Field label="Estado">
            <select name="status" className={inputClass} defaultValue="Entregue">
              <option>Entregue</option>
              <option>Pendente</option>
            </select>
          </Field>
        </FormPanel>

        <FormPanel open={form === "product"} title="Novo produto" saving={saving} onSubmit={onProduct}>
          <Field label="Nome">
            <input name="name" required className={inputClass} placeholder="Garrafão 20L" />
          </Field>
          <Field label="Preço (Kz)">
            <input name="price" type="number" min={0} required className={inputClass} />
          </Field>
          <Field label="Stock">
            <input name="stock" type="number" min={0} defaultValue={0} required className={inputClass} />
          </Field>
          <Field label="Unidade">
            <input name="unit" defaultValue="unidade" required className={inputClass} />
          </Field>
        </FormPanel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card title="Preços e stock">
            <table className="w-full text-sm">
              <thead className="border-b border-edge text-left">
                <tr>
                  <Th>Produto</Th>
                  <Th>Preço</Th>
                  <Th>Stock</Th>
                  <Th>Acção</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/60">
                {data.products.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <Td>{p.name}</Td>
                    <Td>
                      {formatMoney(p.price)}/{p.unit}
                    </Td>
                    <Td className={p.stock < 20 ? "text-warning" : ""}>{p.stock}</Td>
                    <Td>
                      <ActionButton
                        onClick={() =>
                          void run(
                            () => removeRecord({ data: { table: "water_products", id: p.id } }),
                            "Produto removido.",
                          )
                        }
                      >
                        Apagar
                      </ActionButton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Vendas recentes">
            <table className="w-full text-sm">
              <thead className="border-b border-edge text-left">
                <tr>
                  <Th>Item</Th>
                  <Th>Cliente</Th>
                  <Th>Valor</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/60">
                {data.sales.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <Td>
                      {(s.water_products as unknown as { name: string })?.name} × {s.quantity}
                    </Td>
                    <Td>{s.client_name || "—"}</Td>
                    <Td>{formatMoney(s.total)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className={s.status === "Pendente" ? "text-warning" : "text-muted-foreground"}>
                          {s.status}
                        </span>
                        {s.status === "Pendente" ? (
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
