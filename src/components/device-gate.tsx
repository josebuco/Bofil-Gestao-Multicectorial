import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deviceStatus, requestDevice, redeemCode } from "@/lib/devices.functions";
import { getDeviceToken } from "@/lib/device-token";
import { markDeviceApproved, clearDeviceApproved } from "@/components/pwa-manifest";

type St = { status: "none" | "pending" | "approved" | "revoked"; code: string | null };

export function useDeviceStatus() {
  const [st, setSt] = useState<St | null>(null);
  async function refresh() {
    try {
      const next = await deviceStatus({ data: { token: getDeviceToken() } });
      setSt(next);
      if (next.status === "approved") markDeviceApproved();
      else clearDeviceApproved();
    } catch {
      setSt({ status: "none", code: null });
      clearDeviceApproved();
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    if (st?.status !== "pending") return;
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [st?.status]);
  return { st, refresh };
}

export function DeviceLock({ st, refresh, onAdmin }: { st: St; refresh: () => void; onAdmin: () => void }) {
  const [mode, setMode] = useState<"home" | "code">("home");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    try {
      await requestDevice({ data: { token: getDeviceToken() } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }
  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await redeemCode({ data: { token: getDeviceToken(), code: code.trim() } });
      toast.success("Dispositivo autorizado.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-edge bg-panel p-8 shadow-xl text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-md bg-brand text-primary-foreground font-display text-2xl font-bold">B</div>
        <h1 className="mt-4 font-display text-xl font-semibold uppercase tracking-wide text-foreground">Portal interno da Bofil</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acesso restrito a dispositivos autorizados pela administração.</p>

        {st.status === "pending" ? (
          <div className="mt-6 rounded-md border border-edge bg-background p-4">
            <p className="text-sm text-muted-foreground">Pedido enviado. Mostre este número à administração:</p>
            <p className="mt-2 font-display text-3xl tracking-[0.3em] text-foreground">{st.code}</p>
            <p className="mt-2 text-xs text-muted-foreground">A página abre sozinha quando for autorizado.</p>
          </div>
        ) : mode === "home" ? (
          <div className="mt-6 space-y-3">
            {st.status === "revoked" && <p className="text-sm text-destructive">O acesso deste dispositivo foi revogado.</p>}
            <button onClick={ask} disabled={busy} className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              Solicitar acesso para este dispositivo
            </button>
            <button onClick={() => setMode("code")} className="w-full rounded-md border border-edge py-2.5 text-sm font-medium text-foreground hover:bg-accent">
              Já tenho um código
            </button>
          </div>
        ) : (
          <form onSubmit={redeem} className="mt-6 space-y-3">
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded-md border border-edge bg-background px-3 py-3 text-center font-display text-2xl tracking-[0.4em] text-foreground focus:border-primary focus:outline-none"
            />
            <button disabled={busy || code.length !== 6} className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Activar dispositivo
            </button>
            <button type="button" onClick={() => setMode("home")} className="text-sm text-muted-foreground">Voltar</button>
          </form>
        )}

        <button onClick={onAdmin} className="mt-6 text-xs text-muted-foreground underline-offset-2 hover:underline">
          Entrar como administração
        </button>
      </div>
    </div>
  );
}
