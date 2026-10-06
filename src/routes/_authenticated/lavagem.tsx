import { createFileRoute } from "@tanstack/react-router";
import { QuickCashPage } from "@/components/quick-cash";

export const Route = createFileRoute("/_authenticated/lavagem")({
  head: () => ({
    meta: [
      { title: "Estação 4 de Abril — Bofil" },
      { name: "description", content: "Entradas, saídas e saldo automático do setor Lavagem." },
      { property: "og:title", content: "Estação 4 de Abril — Bofil" },
      { property: "og:description", content: "Entradas, saídas e saldo automático do setor Lavagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <QuickCashPage slug="lavagem" title="Estação 4 de Abril" dot="bg-wash" accent="bg-destructive" />,
});
