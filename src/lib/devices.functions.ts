import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenSchema = z.string().min(32).max(128);

async function hash(token: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function sixDigits() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const deviceStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db.from("devices").select("id, status, code").eq("token_hash", await hash(data.token)).maybeSingle();
    if (!row) return { status: "none" as const, code: null };
    if (row.status === "approved") await db.from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", row.id);
    return { status: row.status as "pending" | "approved" | "revoked", code: row.code as string | null };
  });

export const requestDevice = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const h = await hash(data.token);
    const { data: existing } = await db.from("devices").select("status, code").eq("token_hash", h).maybeSingle();
    if (existing) return existing;
    const { count } = await db.from("devices").select("id", { count: "exact", head: true }).eq("status", "pending");
    if ((count ?? 0) >= 30) throw new Error("Demasiados pedidos pendentes. Contacte a administração.");
    const code = sixDigits();
    const { error } = await db.from("devices").insert({ token_hash: h, status: "pending", code });
    if (error) throw new Error(error.message);
    return { status: "pending", code };
  });

export const redeemCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, code: z.string().regex(/^\d{6}$/) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db
      .from("devices")
      .select("id, code_expires_at")
      .eq("status", "code")
      .eq("code", data.code)
      .maybeSingle();
    if (!row || new Date(row.code_expires_at) < new Date()) throw new Error("Código inválido ou expirado.");
    const h = await hash(data.token);
    await db.from("devices").delete().eq("token_hash", h);
    await db
      .from("devices")
      .update({ token_hash: h, status: "approved", approved_at: new Date().toISOString(), code: null, code_expires_at: null })
      .eq("id", row.id);
    return { ok: true };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Apenas a administração.");
}

export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("devices")
      .select("id, status, code, code_expires_at, created_at, approved_at, last_seen_at")
      .order("created_at", { ascending: false });
    return data || [];
  });

export const manageDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject", "revoke"]) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const db = await admin();
    if (data.action === "reject") await db.from("devices").delete().eq("id", data.id);
    else if (data.action === "approve")
      await db.from("devices").update({ status: "approved", approved_at: new Date().toISOString(), code: null }).eq("id", data.id);
    else await db.from("devices").update({ status: "revoked" }).eq("id", data.id);
    return { ok: true };
  });

export const generateDeviceCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await admin();
    const code = sixDigits();
    const expires = new Date(Date.now() + 15 * 60_000).toISOString();
    const { error } = await db.from("devices").insert({ status: "code", code, code_expires_at: expires });
    if (error) throw new Error(error.message);
    return { code, expires };
  });

export const registerAdminDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const db = await admin();
    const h = await hash(data.token);
    await db.from("devices").delete().eq("token_hash", h);
    await db.from("devices").insert({ token_hash: h, status: "approved", approved_at: new Date().toISOString() });
    return { ok: true };
  });
