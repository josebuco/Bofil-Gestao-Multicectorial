import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { readOfflineSession, saveOfflineSession } from "@/lib/offline-session";

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
    // getSession lê o que está guardado no aparelho: funciona sem internet.
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    if (data.session) {
      saveOfflineSession(data.session.user);
      throw redirect({ to: "/dashboard" });
    }
    if (typeof navigator !== "undefined" && !navigator.onLine && readOfflineSession()) {
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
