import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getInvoiceUrl } from "@/lib/expenses.functions";

/** Envia o comprovativo (se houver internet) e devolve o caminho guardado. */
export async function uploadInvoice(file: File | null | undefined, prefix: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("faturas").upload(path, file);
  if (error) throw new Error(error.message);
  return path;
}

export async function openInvoice(path: string) {
  try {
    const { url } = await getInvoiceUrl({ data: { path } });
    window.open(url, "_blank", "noopener");
  } catch {
    toast.error("Não foi possível abrir a fatura.");
  }
}
