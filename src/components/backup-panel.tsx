import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import JSZip from "jszip";
import { toast } from "sonner";
import { Download, FileArchive, HardDriveDownload, LoaderCircle } from "lucide-react";
import { getBackup, type BackupInvoice, type BackupTable } from "@/lib/backup.functions";
import { useAccess } from "@/lib/use-access";

const LABELS: Record<string, string> = {
  sectors: "Setores",
  expense_categories: "Categorias de centro de custos",
  rental_assets: "Veículos e equipamentos",
  water_products: "Produtos de água",
  water_sales: "Vendas e entregas de água",
  restaurant_menu_items: "Menu do restaurante",
  restaurant_tables: "Mesas do restaurante",
  restaurant_orders: "Pedidos do restaurante",
  wash_services: "Serviços de lavagem",
  wash_queue: "Entradas da lavagem",
  school_contracts: "Contratos das escolas",
  school_routes: "Rotas de transporte",
  sector_entries: "Entradas por setor",
  expenses: "Despesas e compras de estoque",
  rental_stock_usage: "Saídas de estoque para veículos",
  bank_deposits: "Depósitos no banco",
  activity_logs: "Histórico de actividade",
  devices: "Dispositivos autorizados",
  staff_accounts: "Contas da equipa",
  user_permissions: "Permissões por setor",
  user_roles: "Funções",
  profiles: "Perfis",
};

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvCell(row[h])).join(","));
  return lines.join("\r\n");
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function BackupPanel() {
  const { isAdmin } = useAccess();
  const backup = useServerFn(getBackup);
  const [busy, setBusy] = useState<"" | "data" | "files">("");
  const [result, setResult] = useState<{ at: string; tables: BackupTable[]; invoices: BackupInvoice[] } | null>(null);
  const [done, setDone] = useState<{ at: string; count: number } | null>(null);

  if (!isAdmin) return null;

  async function run() {
    setBusy("data");
    try {
      const res = await backup();
      setResult({ at: res.generatedAt, tables: res.tables, invoices: res.invoices });
      const zip = new JSZip();
      const total = res.tables.reduce((n, t) => n + t.rows.length, 0);
      zip.file(
        "LEIA-ME.txt",
        [
          "CÓPIA DE SEGURANÇA — BOFIL",
          `Gerada em: ${new Date(res.generatedAt).toLocaleString("pt-PT")}`,
          `Total de registos: ${total}`,
          `Ficheiros de faturas: ${res.invoices.length}`,
          "",
          "Conteúdo:",
          "  json/  — cada tabela em formato JSON (para repor no sistema)",
          "  csv/   — as mesmas tabelas em folhas de cálculo (para abrir no Excel)",
          "",
          "O que é cada pasta:",
          ...res.tables.map((t) => `  ${t.name} — ${LABELS[t.name] ?? t.name} (${t.rows.length} registos)`),
          "",
          "Guarde este ficheiro fora da Lovable: um pen drive, um disco externo ou o seu Google Drive.",
        ].join("\r\n"),
      );
      for (const table of res.tables) {
        zip.file(`json/${table.name}.json`, JSON.stringify(table.rows, null, 2));
        const csv = toCsv(table.rows);
        if (csv) zip.file(`csv/${table.name}.csv`, csv);
      }
      save(await zip.generateAsync({ type: "blob" }), `bofil-registos-${stamp()}.zip`);
      setDone({ at: res.generatedAt, count: total });
      toast.success("Cópia dos registos descarregada. Guarde-a num pen drive ou no seu Drive.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a cópia.");
    } finally {
      setBusy("");
    }
  }

  async function runFiles() {
    if (!result) {
      toast.error("Primeiro gere a cópia dos registos.");
      return;
    }
    if (result.invoices.length === 0) {
      toast.info("Ainda não há ficheiros de faturas guardados.");
      return;
    }
    setBusy("files");
    try {
      const zip = new JSZip();
      let ok = 0;
      for (const invoice of result.invoices) {
        try {
          const res = await fetch(invoice.url);
          if (!res.ok) continue;
          zip.file(`faturas/${invoice.path.replace(/[\\/]/g, "_")}`, await res.arrayBuffer());
          ok += 1;
        } catch {
          /* ficheiro indisponível de momento */
        }
      }
      if (ok === 0) throw new Error("Não foi possível descarregar os ficheiros das faturas.");
      save(await zip.generateAsync({ type: "blob" }), `bofil-faturas-${stamp()}.zip`);
      toast.success(`${ok} fatura(s) guardada(s) no seu computador.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível descarregar as faturas.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-xl bg-panel ring-1 ring-edge p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide flex items-center gap-2">
            <HardDriveDownload className="size-5 text-brand" /> Cópia de segurança
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Descarrega todos os registos da empresa (entradas, despesas, estoque, veículos, contas) para um
            ficheiro que fica consigo, fora da nuvem. Faça isto de vez em quando — é a sua garantia.
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => void run()}
            disabled={busy !== ""}
            className="px-5 py-2.5 rounded-lg bg-brand text-primary-foreground text-sm font-bold uppercase tracking-tight flex items-center gap-2 disabled:opacity-50"
          >
            {busy === "data" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
            {busy === "data" ? "A preparar…" : "Descarregar registos"}
          </button>
          <button
            onClick={() => void runFiles()}
            disabled={busy !== "" || !result}
            className="px-4 py-2 rounded-lg ring-1 ring-edge text-xs font-bold uppercase tracking-tight text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center gap-2 disabled:opacity-40"
          >
            {busy === "files" ? <LoaderCircle className="size-3.5 animate-spin" /> : <FileArchive className="size-3.5" />}
            {busy === "files" ? "A juntar…" : "Descarregar faturas"}
          </button>
        </div>
      </div>

      {done ? (
        <p className="text-xs text-success rounded-lg bg-success/10 ring-1 ring-success/30 px-4 py-3">
          Última cópia gerada em {new Date(done.at).toLocaleString("pt-PT")} — {done.count} registos.
          {result ? ` Ficheiros de faturas disponíveis: ${result.invoices.length}.` : ""}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-edge px-4 py-3">
          Ainda não fez nenhuma cópia nesta sessão. Clique em <strong>Descarregar registos</strong> e guarde o
          ficheiro que aparece na pasta das Transferências do seu computador.
        </p>
      )}
    </div>
  );
}
