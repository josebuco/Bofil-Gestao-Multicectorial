ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS stock_unit text;
COMMENT ON COLUMN public.expenses.stock_unit IS 'litro = combustível; null/unidade = peças e materiais';