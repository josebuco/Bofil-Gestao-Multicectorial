ALTER TABLE public.sector_entries ADD COLUMN status text NOT NULL DEFAULT 'Pago';
ALTER TABLE public.sector_entries ADD COLUMN client_name text;
COMMENT ON COLUMN public.sector_entries.status IS 'Pago ou Pendente; entradas pendentes não entram nas receitas nem no saldo até serem pagas.';