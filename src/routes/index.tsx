import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bofil — Gestão Multi-Setorial" },
      { name: "description", content: "Aceda ao sistema de gestão multi-setorial Bofil." },
      { property: "og:title", content: "Bofil — Gestão Multi-Setorial" },
      { property: "og:description", content: "Aceda ao sistema de gestão multi-setorial Bofil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
