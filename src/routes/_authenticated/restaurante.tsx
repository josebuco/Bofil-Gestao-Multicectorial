import { createFileRoute } from "@tanstack/react-router";
import { QuickCashPage } from "@/components/quick-cash";

export const Route = createFileRoute("/_authenticated/restaurante")({
  head: () => ({
    meta: [
      { title: "Restaurante — Bofil" },
      { name: "description", content: "Entradas, saídas e saldo automático do setor Restaurante." },
      { property: "og:title", content: "Restaurante — Bofil" },
      { property: "og:description", content: "Entradas, saídas e saldo automático do setor Restaurante." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <QuickCashPage slug="restaurante" title="Restaurante" dot="bg-restaurant" accent="bg-restaurant" />,
});
