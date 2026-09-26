import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const applyBofilAdminCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas o administrador pode alterar este acesso.");

    const email = process.env["BOFIL_ADMIN_EMAIL"]!;
    const password = process.env["BOFIL_ADMIN_PASSWORD"]!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true, email };
  });