import { createFileRoute } from "@tanstack/react-router";
import { FleetPage } from "@/components/fleet-page";

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
  component: () => <FleetPage sector="transporte" title="Transporte Escolar" subtitle="Cada viatura com alunos embarcados, custos e estoque" dot="bg-transport" />,
});
