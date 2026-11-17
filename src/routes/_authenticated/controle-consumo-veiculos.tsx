import { createFileRoute } from "@tanstack/react-router";
import { VehicleControlPage } from "@/components/vehicle-control-page";

export const Route = createFileRoute("/_authenticated/controle-consumo-veiculos")({
  head: () => ({
    meta: [
      { title: "Controle de consumo dos veículos — Bofil" },
      { name: "description", content: "Consumos, entradas e compras de estoque partilhado por veículo na Bofil." },
      { property: "og:title", content: "Controle de consumo dos veículos — Bofil" },
      { property: "og:description", content: "Consumos, entradas e compras de estoque partilhado por veículo na Bofil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VehicleControlPage,
});