import { createFileRoute } from "@tanstack/react-router";
import { FleetPage } from "@/components/fleet-page";

export const Route = createFileRoute("/_authenticated/aluguer")({
  head: () => ({
    meta: [
      { title: "Aluguer de Veículos e Equipamentos — Bofil" },
      { name: "description", content: "Cadastro de veículos e equipamentos com entradas e centro de custos por unidade." },
      { property: "og:title", content: "Aluguer de Veículos e Equipamentos — Bofil" },
      { property: "og:description", content: "Cadastro de veículos e equipamentos com entradas e centro de custos por unidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <FleetPage sector="aluguer" title="Aluguer de Veículos e Equipamentos" subtitle="Cada unidade com as suas entradas e o seu centro de custos" dot="bg-primary" />,
});

