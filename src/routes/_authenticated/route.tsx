import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/use-access";
import { useQueryClient } from "@tanstack/react-query";
import { deviceStatus, registerAdminDevice } from "@/lib/devices.functions";
import { getDeviceToken } from "@/lib/device-token";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    const token = getDeviceToken();
    const dev = await deviceStatus({ data: { token } }).catch(() => null);
    if (dev && dev.status !== "approved") {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
      if (isAdmin) await registerAdminDevice({ data: { token } });
      else {
        await supabase.auth.signOut();
        throw redirect({ to: "/auth" });
      }
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const allSectors = [
  { id: "/dashboard", label: "Painel geral", color: "bg-primary", perm: "admin" },
  { id: "/agua", label: "Água", color: "bg-water", perm: "agua" },
  { id: "/restaurante", label: "Restaurante", color: "bg-restaurant", perm: "restaurante" },
  { id: "/lavagem", label: "Lavagem", color: "bg-wash", perm: "lavagem" },
  { id: "/transporte", label: "Transporte Escolar", color: "bg-transport", perm: "transporte" },
  { id: "/custos", label: "Centro de Custos", color: "bg-brand", perm: "custos" },
  { id: "/faturacao", label: "Faturação", color: "bg-wash", perm: "admin" },
  { id: "/utilizadores", label: "Utilizadores", color: "bg-muted-foreground", perm: "admin" },
] as const;

function AuthenticatedLayout() {
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState(router.state.location.pathname);

  useEffect(() => {
    const unsubscribe = router.subscribe("onResolved", () => {
      setCurrentPath(router.state.location.pathname);
    });
    return () => unsubscribe();
  }, [router]);

  const queryClient = useQueryClient();
  const access = useAccess();
  const sectors = allSectors.filter((s) => access.isAdmin || access.sectors.includes(s.perm));

  useEffect(() => {
    if ("loading" in access || access.isAdmin) return;
    const allowed = sectors.some((s) => currentPath.startsWith(s.id));
    if (!allowed && sectors[0]) router.navigate({ to: sectors[0].id, replace: true });
  }, [access, currentPath]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-60 shrink-0 border-r border-edge bg-ink flex flex-col">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-edge">
          <div className="size-8 rounded-md bg-brand grid place-items-center font-display font-semibold text-primary-foreground text-lg">
            B
          </div>
          <div className="leading-none">
            <p className="font-display font-semibold tracking-wide text-foreground text-[15px] uppercase">
              Bofil
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
              Gestão multi-setorial
            </p>
          </div>
        </div>

        <nav className="py-4 flex-1">
          <p className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Sector
          </p>
          {sectors.map((sector) => {
            const isActive = currentPath === sector.id || (sector.id === "/dashboard" && currentPath === "/");
            return (
              <Link
                key={sector.id}
                to={sector.id}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition-colors ${
                  isActive
                    ? "bg-primary/10 text-foreground border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-white/5"
                }`}
              >
                <span className={`size-1.5 rounded-full shrink-0 ${sector.color}`} />
                <span className="font-medium">{sector.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-edge">
          <button
            onClick={handleSignOut}
            className="w-full rounded-md bg-panel ring-1 ring-black/5 p-3 text-left flex items-center gap-3 hover:bg-white/5 transition-colors"
          >
            <div className="size-9 rounded-md bg-edge grid place-items-center font-display font-semibold text-muted-foreground text-sm">
              {access.isAdmin ? "AD" : "TR"}
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{access.name || "…"}</p>
              <p className="text-[11px] text-muted-foreground truncate">Sair da conta</p>
            </div>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
