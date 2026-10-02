import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------
   Cópia de segurança: lê todos os registos da empresa para a
   administração poder guardar uma cópia fora da nuvem.
------------------------------------------------------------------- */

export type BackupRow = { [key: string]: string | number | boolean | null };

type Result = { data: BackupRow[] | null; error: { message: string } | null };
type Builder = PromiseLike<Result> & {
  range: (a: number, b: number) => Builder;
  order: (c: string) => Builder;
};
type Client = { from: (t: string) => { select: (c: string) => Builder } };

type Stored = { name: string; updated_at?: string | null; id?: string };
type StorageClient = {
  storage: {
    from: (b: string) => {
      list: (folder?: string, opts?: { limit?: number }) => PromiseLike<{ data: Stored[] | null; error: { message: string } | null }>;
      createSignedUrls: (
        paths: string[],
        seconds: number,
      ) => PromiseLike<{ data: { path: string; signedUrl: string | null }[] | null; error: { message: string } | null }>;
    };
  };
};

const PAGE = 1000;

async function allRows(client: unknown, table: string, order: string) {
  const sb = client as unknown as Client;
  const rows: BackupRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select("*").range(from, from + PAGE - 1).order(order);
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

/** Lista tudo o que está no arquivo das faturas, incluindo subpastas. */
async function listStored(client: unknown, bucket: string, folder = ""): Promise<Stored[]> {
  const sb = client as unknown as StorageClient;
  const out: Stored[] = [];
  const { data, error } = await sb.storage.from(bucket).list(folder || undefined, { limit: 1000 });
  if (error) throw new Error(`faturas: ${error.message}`);
  for (const item of data ?? []) {
    const path = folder ? `${folder}/${item.name}` : item.name;
    if (item.id) out.push({ ...item, name: path });
    else out.push(...(await listStored(client, bucket, path)));
  }
  return out;
}

const TABLES: { table: string; order: string }[] = [
  { table: "sectors", order: "id" },
  { table: "expense_categories", order: "id" },
  { table: "rental_assets", order: "id" },
  { table: "water_products", order: "id" },
  { table: "water_sales", order: "id" },
  { table: "restaurant_menu_items", order: "id" },
  { table: "restaurant_tables", order: "id" },
  { table: "restaurant_orders", order: "id" },
  { table: "wash_services", order: "id" },
  { table: "wash_queue", order: "id" },
  { table: "school_contracts", order: "id" },
  { table: "school_routes", order: "id" },
  { table: "sector_entries", order: "id" },
  { table: "expenses", order: "id" },
  { table: "rental_stock_usage", order: "id" },
  { table: "bank_deposits", order: "id" },
  { table: "sector_transfers", order: "id" },
  { table: "activity_logs", order: "id" },
  { table: "devices", order: "id" },
  { table: "staff_accounts", order: "user_id" },
  { table: "user_permissions", order: "id" },
  { table: "user_roles", order: "id" },
];

export type BackupTable = { name: string; rows: BackupRow[] };
export type BackupInvoice = { path: string; url: string; updated_at: string | null };

export const getBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Só a administração pode fazer a cópia de segurança.");

    const tables: BackupTable[] = [];
    for (const { table, order } of TABLES) {
      tables.push({ name: table, rows: await allRows(context.supabase, table, order) });
    }

    // Perfis e ficheiros das faturas não ficam acessíveis pela conta normal:
    // só aqui, depois de confirmada a função de administrador.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    tables.push({ name: "profiles", rows: await allRows(supabaseAdmin, "profiles", "id") });

    const stored = await listStored(supabaseAdmin, "faturas");
    const invoices: BackupInvoice[] = [];
    for (let i = 0; i < stored.length; i += 100) {
      const chunk = stored.slice(i, i + 100);
      const { data: signed, error } = await supabaseAdmin.storage
        .from("faturas")
        .createSignedUrls(chunk.map((f) => f.name), 3600);
      if (error) throw new Error(`faturas: ${error.message}`);
      const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      for (const f of chunk) {
        const url = urls.get(f.name);
        if (url) invoices.push({ path: f.name, url, updated_at: f.updated_at ?? null });
      }
    }

    return { generatedAt: new Date().toISOString(), tables, invoices };
  });
