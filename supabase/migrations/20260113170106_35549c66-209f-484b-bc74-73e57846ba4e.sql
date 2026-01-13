-- Update can_access_ose to allow any supervisor to access any OSE
CREATE OR REPLACE FUNCTION public.can_access_ose(_ose_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'gestor'::app_role)
    OR public.has_role(_user_id, 'supervisor'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.oses 
      WHERE id = _ose_id 
      AND created_by = _user_id
    )
$$;

-- Update oses SELECT policy to allow any supervisor to view all OSEs
DROP POLICY IF EXISTS "Anyone authenticated can view oses they have access to" ON oses;
CREATE POLICY "Anyone authenticated can view oses"
ON oses FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR created_by = auth.uid()
);

-- Update oses INSERT policy to allow any authenticated user
DROP POLICY IF EXISTS "Authenticated users can create oses" ON oses;
CREATE POLICY "Authenticated users can create oses"
ON oses FOR INSERT
WITH CHECK (created_by = auth.uid());

-- Update oses UPDATE policy
DROP POLICY IF EXISTS "Users can update oses" ON oses;
CREATE POLICY "Users can update oses"
ON oses FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR created_by = auth.uid()
);

-- Update oses DELETE policy
DROP POLICY IF EXISTS "Admins can delete oses" ON oses;
CREATE POLICY "Users can delete oses"
ON oses FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR created_by = auth.uid()
);