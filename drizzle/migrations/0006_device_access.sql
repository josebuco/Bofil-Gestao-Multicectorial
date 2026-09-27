CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE,
  code text,
  status text NOT NULL DEFAULT 'pending',
  code_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  last_seen_at timestamptz
);
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read devices" ON public.devices FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.devices TO authenticated;