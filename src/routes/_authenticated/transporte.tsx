import { createFileRoute } from "@tanstack/react-router";
import { QuickCashPage } from "@/components/quick-cash";

export const Route = createFileRoute("/_authenticated/transporte")({
  head: () => ({
    meta: [
      { title: "Transporte Escolar — Bofil" },
      { name: "description", content: "Entradas, saídas e saldo automático do setor Transporte Escolar." },
      { property: "og:title", content: "Transporte Escolar — Bofil" },
      { property: "og:description", content: "Entradas, saídas e saldo automático do setor Transporte Escolar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <QuickCashPage slug="transporte" title="Transporte Escolar" dot="bg-transport" accent="bg-transport" />,
});
