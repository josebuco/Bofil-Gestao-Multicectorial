DROP POLICY IF EXISTS "Staff read categories" ON public.expense_categories;
CREATE POLICY "Staff read categories" ON public.expense_categories
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'tecnico'::app_role)
);