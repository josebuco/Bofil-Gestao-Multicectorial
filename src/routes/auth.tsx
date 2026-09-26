import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Bofil" },
      { name: "description", content: "Aceda ao painel de gestão Bofil." },
      { property: "og:title", content: "Entrar — Bofil" },
      { property: "og:description", content: "Aceda ao painel de gestão Bofil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-edge bg-panel p-8 shadow-xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-brand text-primary-foreground font-display text-xl font-bold">
            B
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold uppercase tracking-wide text-foreground">
              Bofil
            </h1>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Gestão multi-setorial
            </p>
          </div>
        </div>

        <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-foreground">
          Entrar
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aceda ao painel de gestão da sua empresa.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="gestor@empresa.ao"
              className="w-full rounded-md border border-edge bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Palavra-passe
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-edge bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Aguarde..." : "Entrar no painel"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          O acesso é criado pela administração.
        </p>
      </div>
    </div>
  );
}
