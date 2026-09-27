import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, MonitorSmartphone, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { PERMISSION_OPTIONS, createStaff, deleteStaff, listStaff, updateAdminCredentials, updateStaff } from "@/lib/access.functions";
import { applyBofilAdminCredentials } from "@/lib/admin-setup.functions";
import { generateDeviceCode, listDevices, manageDevice } from "@/lib/devices.functions";
import { Field, inputClass } from "@/components/panel";

export const Route = createFileRoute("/_authenticated/utilizadores")({
  head: () => ({
    meta: [
      { title: "Utilizadores — Bofil" },
      { name: "description", content: "Contas, permissões por setor e dispositivos autorizados da Bofil." },
      { property: "og:title", content: "Utilizadores — Bofil" },
      { property: "og:description", content: "Contas, permissões por setor e dispositivos autorizados da Bofil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

const ROLE_LABELS = ["Técnico de Registo - Água", "Técnico de Registo", "Caixa", "Gerente de Setor", "Outro"];
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-PT", { timeZone: "Africa/Luanda" }) : "—");
const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

function UsersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listStaff);
  const create = useServerFn(createStaff);
  const update = useServerFn(updateStaff);
  const updateAdmin = useServerFn(updateAdminCredentials);
  const applyRequestedAdmin = useServerFn(applyBofilAdminCredentials);
  const remove = useServerFn(deleteStaff);
  const { data: staff = [], error } = useQuery({ queryKey: ["staff"], queryFn: () => list() });
  const { data: devices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: () => listDevices(),
    refetchInterval: 10_000,
  });
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<string[]>(["agua", "custos"]);
  const [saving, setSaving] = useState(false);
  const [gen, setGen] = useState<{ code: string; expires: string } | null>(null);

  async function run(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      toast.success(msg);
      await qc.invalidateQueries({ queryKey: ["staff"] });
      await qc.invalidateQueries({ queryKey: ["devices"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.");
    }
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    setSaving(true);
    await run(
      () =>
        create({
          data: {
            full_name: String(f.get("full_name")),
            email: String(f.get("email")),
            password: String(f.get("password")),
            role_label: String(f.get("role_label")),
            sectors: perms as never,
          },
        }),
      "Conta criada. Entregue o e-mail e a palavra-passe ao técnico.",
    );
    setSaving(false);
    form.reset();
    setOpen(false);
  }

  async function onUpdateAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    await run(
      () => updateAdmin({ data: { email: String(f.get("email")), password: String(f.get("password")) } }),
      "Credenciais da conta administrativa actualizadas.",
    );
    setSaving(false);
  }

  async function applyRequestedCredentials() {
    setSaving(true);
    await run(() => applyRequestedAdmin(), "A conta administrativa Bofil foi actualizada. Entre novamente com o novo acesso.");
    setSaving(false);
  }

  async function deviceAction(id: string, action: "approve" | "reject" | "revoke") {
    if (action === "revoke" && !confirm("Revogar o acesso deste dispositivo?")) return;
    try {
      await manageDevice({ data: { id, action } });
      qc.invalidateQueries({ queryKey: ["devices"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const pendingDevices = devices.filter((d: any) => d.status === "pending");
  const activeDevices = devices.filter((d: any) => d.status === "approved");

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Cabeçalho + acesso administrativo */}
        <div className="rounded-xl bg-panel ring-1 ring-edge p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-brand">
                Gestão de Utilizadores
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Contas, permissões e dispositivos autorizados.</p>
            </div>
            <button
              onClick={() => setOpen(!open)}
              className="px-5 py-2 rounded-lg bg-brand text-primary-foreground text-sm font-bold font-display uppercase tracking-tight flex items-center gap-2"
            >
              <UserPlus className="size-4" /> Nova conta
            </button>
          </div>

          <form onSubmit={onUpdateAdmin} className="mt-6 pt-5 border-t border-edge/60 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Conta administrativa</p>
              <div className="flex items-center gap-3 bg-ink/60 p-3 rounded-lg ring-1 ring-edge">
                <span className="size-2 rounded-full bg-brand shadow-[0_0_8px_var(--brand)]" />
                <span className="text-sm font-medium truncate">bofil.lda@gmail.com</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Actualizar segurança</p>
              <div className="flex gap-2">
                <input type="hidden" name="email" value="bofil.lda@gmail.com" />
                <input name="password" type="password" minLength={8} required placeholder="Nova palavra-passe" className={inputClass} />
                <button disabled={saving} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-tight disabled:opacity-50 shrink-0">
                  Salvar
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void applyRequestedCredentials()}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
              >
                Aplicar credenciais Bofil pedidas
              </button>
            </div>
          </form>
        </div>

        {error ? <p className="text-destructive text-sm">{(error as Error).message}</p> : null}

        {/* Nova conta */}
        {open ? (
          <form onSubmit={onCreate} className="rounded-xl bg-panel ring-1 ring-brand/30 p-6 space-y-4">
            <h2 className="font-display text-base font-semibold uppercase tracking-wide">Nova conta</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome completo">
                <input name="full_name" required className={inputClass} />
              </Field>
              <Field label="Função">
                <select name="role_label" className={inputClass}>
                  {ROLE_LABELS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="E-mail de acesso">
                <input name="email" type="email" required className={inputClass} />
              </Field>
              <Field label="Palavra-passe (mín. 6)">
                <input name="password" type="text" minLength={6} required className={inputClass} />
              </Field>
            </div>
            <PermPicker value={perms} onChange={setPerms} />
            <div className="flex gap-2">
              <button disabled={saving} className="px-5 py-2 rounded-lg bg-brand text-primary-foreground text-sm font-bold uppercase tracking-tight disabled:opacity-50">
                {saving ? "A criar…" : "Criar conta"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg ring-1 ring-edge text-sm text-muted-foreground">
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        {/* Lista de contas */}
        <div className="space-y-4">
          {staff.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground rounded-xl bg-panel ring-1 ring-edge">Ainda não há técnicos criados.</p>
          ) : null}
          {staff.map((s) => (
            <div key={s.user_id} className="rounded-xl bg-panel ring-1 ring-edge hover:ring-brand/40 p-5 transition-all">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4 min-w-0">
                  <div className="size-12 rounded-full bg-secondary grid place-items-center font-display text-lg text-brand shrink-0">
                    {initials(s.full_name || "?")}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-base">{s.full_name}</h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ring-1 ${
                          s.active ? "text-success ring-success/30 bg-success/10" : "text-destructive ring-destructive/30 bg-destructive/10"
                        }`}
                      >
                        {s.active ? "Activo" : "Suspenso"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {s.role_label} · {s.email}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const pw = prompt("Nova palavra-passe (mín. 6 caracteres):");
                      if (pw && pw.length >= 6)
                        void run(() => update({ data: { user_id: s.user_id, password: pw } }), "Palavra-passe alterada.");
                    }}
                    className="px-3 py-2 text-xs rounded-lg ring-1 ring-edge text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center gap-1.5"
                  >
                    <KeyRound className="size-3.5" /> Redefinir
                  </button>
                  <button
                    onClick={() => void run(() => update({ data: { user_id: s.user_id, active: !s.active } }), s.active ? "Conta suspensa." : "Conta activada.")}
                    className="px-3 py-2 text-xs rounded-lg ring-1 ring-edge text-muted-foreground hover:text-warning hover:bg-warning/10"
                  >
                    {s.active ? "Suspender" : "Activar"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Apagar a conta de ${s.full_name}?`))
                        void run(() => remove({ data: { user_id: s.user_id } }), "Conta apagada.");
                    }}
                    className="px-3 py-2 text-xs rounded-lg ring-1 ring-edge text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label="Apagar conta"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-edge/60">
                <PermPicker
                  value={s.sectors}
                  onChange={(next) => void run(() => update({ data: { user_id: s.user_id, sectors: next as never } }), "Permissões actualizadas.")}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Dispositivos */}
        <div className="rounded-xl bg-panel ring-1 ring-edge p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide flex items-center gap-2">
                <MonitorSmartphone className="size-5 text-brand" /> Dispositivos
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Só os aparelhos autorizados conseguem abrir o ecrã de entrada.</p>
            </div>
            <button
              onClick={async () => setGen(await generateDeviceCode())}
              className="px-4 py-2 rounded-lg bg-brand text-primary-foreground text-xs font-bold uppercase tracking-tight"
            >
              Gerar código
            </button>
          </div>

          {gen ? (
            <div className="rounded-lg bg-ink/60 ring-1 ring-edge p-4 text-center">
              <p className="font-display text-3xl tracking-[0.3em] text-brand">{gen.code}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Válido até {fmt(gen.expires)}</p>
            </div>
          ) : null}

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
              Pedidos pendentes ({pendingDevices.length})
            </p>
            {pendingDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center rounded-lg border border-dashed border-edge">Nenhum pedido.</p>
            ) : (
              <div className="space-y-2">
                {pendingDevices.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg bg-ink/40 ring-1 ring-edge px-4 py-3">
                    <div>
                      <p className="font-display text-lg tracking-[0.25em]">{d.code}</p>
                      <p className="text-xs text-muted-foreground">{fmt(d.created_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void deviceAction(d.id, "approve")} className="px-3 py-1.5 rounded-lg bg-success text-success-foreground text-xs font-bold uppercase">
                        Autorizar
                      </button>
                      <button onClick={() => void deviceAction(d.id, "reject")} className="px-3 py-1.5 rounded-lg ring-1 ring-edge text-xs text-muted-foreground">
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
              Dispositivos autorizados ({activeDevices.length})
            </p>
            <div className="space-y-2">
              {activeDevices.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg bg-ink/40 ring-1 ring-edge px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Autorizado em {fmt(d.approved_at)}</p>
                    <p className="text-xs text-muted-foreground">Último uso: {fmt(d.last_seen_at)}</p>
                  </div>
                  <button onClick={() => void deviceAction(d.id, "revoke")} className="text-[10px] font-bold uppercase text-destructive hover:underline">
                    Revogar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PermPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2 flex items-center gap-1.5">
        <ShieldCheck className="size-3.5" /> Permissões (acesso apenas ao dia actual)
      </p>
      <div className="flex flex-wrap gap-2">
        {PERMISSION_OPTIONS.map((p) => {
          const on = value.includes(p.slug);
          return (
            <button
              type="button"
              key={p.slug}
              onClick={() => onChange(on ? value.filter((x) => x !== p.slug) : [...value, p.slug])}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded ring-1 transition-colors ${
                on ? "bg-brand/10 ring-brand/30 text-brand" : "ring-edge text-muted-foreground opacity-60 hover:opacity-100"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
