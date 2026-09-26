import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { PERMISSION_OPTIONS, createStaff, deleteStaff, listStaff, updateAdminCredentials, updateStaff } from "@/lib/access.functions";
import { applyBofilAdminCredentials } from "@/lib/admin-setup.functions";
import { Card, Field, PageHeader, inputClass } from "@/components/panel";

export const Route = createFileRoute("/_authenticated/utilizadores")({
  head: () => ({
    meta: [
      { title: "Utilizadores e Permissões — Bofil" },
      { name: "description", content: "Contas dos técnicos de registo e permissões por setor." },
      { property: "og:title", content: "Utilizadores e Permissões — Bofil" },
      { property: "og:description", content: "Contas dos técnicos de registo e permissões por setor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

const ROLE_LABELS = ["Técnico de Registo - Água", "Técnico de Registo", "Caixa", "Gerente de Setor", "Outro"];

function UsersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listStaff);
  const create = useServerFn(createStaff);
  const update = useServerFn(updateStaff);
  const updateAdmin = useServerFn(updateAdminCredentials);
  const applyRequestedAdmin = useServerFn(applyBofilAdminCredentials);
  const remove = useServerFn(deleteStaff);
  const { data: staff = [], error } = useQuery({ queryKey: ["staff"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<string[]>(["agua", "custos"]);
  const [saving, setSaving] = useState(false);

  async function run(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      toast.success(msg);
      await qc.invalidateQueries({ queryKey: ["staff"] });
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

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <PageHeader
        dot="bg-brand"
        title="Utilizadores"
        subtitle="Uma única conta de administrador · técnicos com acesso diário"
        action={
          <button
            onClick={() => setOpen(!open)}
            className="px-3 py-1.5 text-sm font-medium text-primary-foreground bg-brand rounded-md flex items-center gap-2"
          >
            <UserPlus className="size-4" /> Nova conta
          </button>
        }
      />
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {error ? <p className="text-destructive text-sm">{(error as Error).message}</p> : null}

        <form onSubmit={onUpdateAdmin} className="rounded-xl bg-panel ring-1 ring-edge p-5 space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold uppercase text-foreground">Conta administrativa</h2>
            <p className="mt-1 text-xs text-muted-foreground">Actualize o único acesso com controlo total do sistema.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="E-mail do administrador">
              <input name="email" type="email" defaultValue="bofil.lda@gmail.com" required className={inputClass} />
            </Field>
            <Field label="Nova palavra-passe">
              <input name="password" type="password" minLength={8} required className={inputClass} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={saving} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {saving ? "A actualizar…" : "Actualizar acesso administrativo"}
            </button>
            <button type="button" disabled={saving} onClick={() => void applyRequestedCredentials()} className="px-4 py-2 rounded-md ring-1 ring-edge text-foreground text-sm font-medium disabled:opacity-50">
              Aplicar credenciais Bofil pedidas
            </button>
          </div>
        </form>

        {open ? (
          <form onSubmit={onCreate} className="rounded-xl bg-panel ring-1 ring-edge p-5 space-y-4">
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
            <button disabled={saving} className="px-4 py-2 rounded-md bg-brand text-primary-foreground text-sm font-medium disabled:opacity-50">
              {saving ? "A criar…" : "Criar conta"}
            </button>
          </form>
        ) : null}

        <Card title="Contas e permissões">
          <div className="divide-y divide-edge/60">
            {staff.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Ainda não há técnicos criados.</p> : null}
            {staff.map((s) => (
              <div key={s.user_id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {s.full_name}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 ${s.active ? "text-success ring-success/30" : "text-destructive ring-destructive/30"}`}>
                        {s.active ? "Activo" : "Suspenso"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.role_label} · Login: <span className="text-foreground">{s.email}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const pw = prompt("Nova palavra-passe (mín. 6 caracteres):");
                        if (pw && pw.length >= 6)
                          void run(() => update({ data: { user_id: s.user_id, password: pw } }), "Palavra-passe alterada.");
                      }}
                      className="px-2.5 py-1.5 text-xs rounded-md ring-1 ring-edge flex items-center gap-1.5"
                    >
                      <KeyRound className="size-3.5" /> Redefinir senha
                    </button>
                    <button
                      onClick={() => void run(() => update({ data: { user_id: s.user_id, active: !s.active } }), s.active ? "Conta suspensa." : "Conta activada.")}
                      className="px-2.5 py-1.5 text-xs rounded-md ring-1 ring-edge"
                    >
                      {s.active ? "Suspender" : "Activar"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Apagar a conta de ${s.full_name}?`))
                          void run(() => remove({ data: { user_id: s.user_id } }), "Conta apagada.");
                      }}
                      className="px-2.5 py-1.5 text-xs rounded-md ring-1 ring-edge text-destructive"
                      aria-label="Apagar conta"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <PermPicker
                  value={s.sectors}
                  onChange={(next) => void run(() => update({ data: { user_id: s.user_id, sectors: next as never } }), "Permissões actualizadas.")}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PermPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2 flex items-center gap-1.5">
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
              className={`px-3 py-1.5 text-xs rounded-full ring-1 transition-colors ${on ? "bg-brand/15 ring-brand text-foreground" : "ring-edge text-muted-foreground"}`}
            >
              {on ? "✓ " : ""}
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
