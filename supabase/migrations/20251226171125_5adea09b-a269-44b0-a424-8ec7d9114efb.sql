
-- Create function to check if user has a specific permission profile
CREATE OR REPLACE FUNCTION public.has_permission_profile(_user_id uuid, _profile_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    JOIN public.permission_profiles pp ON pp.id = up.profile_id
    WHERE up.user_id = _user_id
      AND LOWER(pp.name) = LOWER(_profile_name)
  )
$$;

-- Update vehicles RLS policies to include Frotas profile
DROP POLICY IF EXISTS "Supervisors can view vehicles of their teams" ON public.vehicles;
CREATE POLICY "Supervisors can view vehicles of their teams" 
ON public.vehicles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_permission_profile(auth.uid(), 'Frotas')
  OR (team_id IN (SELECT get_user_team_ids(auth.uid())))
);

-- Update workshop_entries RLS policies to include Frotas profile
DROP POLICY IF EXISTS "Supervisors can view workshop entries of their team vehicles" ON public.workshop_entries;
CREATE POLICY "Supervisors can view workshop entries of their team vehicles" 
ON public.workshop_entries 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_permission_profile(auth.uid(), 'Frotas')
  OR (vehicle_id IN (SELECT vehicles.id FROM vehicles WHERE vehicles.team_id IN (SELECT get_user_team_ids(auth.uid()))))
);

DROP POLICY IF EXISTS "Supervisors can manage workshop entries of their team vehicles" ON public.workshop_entries;
CREATE POLICY "Supervisors can manage workshop entries of their team vehicles" 
ON public.workshop_entries 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_permission_profile(auth.uid(), 'Frotas')
  OR (vehicle_id IN (SELECT vehicles.id FROM vehicles WHERE vehicles.team_id IN (SELECT get_user_team_ids(auth.uid()))))
);

DROP POLICY IF EXISTS "Supervisors can update workshop entries of their team vehicles" ON public.workshop_entries;
CREATE POLICY "Supervisors can update workshop entries of their team vehicles" 
ON public.workshop_entries 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_permission_profile(auth.uid(), 'Frotas')
  OR (vehicle_id IN (SELECT vehicles.id FROM vehicles WHERE vehicles.team_id IN (SELECT get_user_team_ids(auth.uid()))))
);

-- Add DELETE policy for Frotas on workshop_entries
DROP POLICY IF EXISTS "Users can delete workshop entries" ON public.workshop_entries;
CREATE POLICY "Users can delete workshop entries" 
ON public.workshop_entries 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_permission_profile(auth.uid(), 'Frotas')
);
