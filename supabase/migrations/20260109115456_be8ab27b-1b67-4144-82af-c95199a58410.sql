-- Create security definer function to check if user can access OSE
CREATE OR REPLACE FUNCTION public.can_access_ose(_ose_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.oses 
    WHERE id = _ose_id 
    AND (
      created_by = _user_id 
      OR public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'gestor'::app_role)
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.ose_trips ot
    WHERE ot.ose_id = _ose_id 
    AND ot.team_id IN (SELECT public.get_user_team_ids(_user_id))
  )
$$;

-- Create security definer function to check if user owns OSE
CREATE OR REPLACE FUNCTION public.is_ose_owner(_ose_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.oses 
    WHERE id = _ose_id 
    AND created_by = _user_id
  )
$$;

-- Drop existing problematic policies on oses
DROP POLICY IF EXISTS "Users can view oses" ON public.oses;
DROP POLICY IF EXISTS "Users can update their own oses" ON public.oses;
DROP POLICY IF EXISTS "Users can create oses" ON public.oses;
DROP POLICY IF EXISTS "Admins and gestors can manage all oses" ON public.oses;

-- Create new simplified policies for oses
CREATE POLICY "Anyone authenticated can view oses they have access to"
ON public.oses
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Authenticated users can create oses"
ON public.oses
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update oses"
ON public.oses
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

CREATE POLICY "Admins can delete oses"
ON public.oses
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

-- Drop and recreate ose_trips policies
DROP POLICY IF EXISTS "Users can manage their own ose_trips" ON public.ose_trips;
DROP POLICY IF EXISTS "Admins and gestors can manage all ose_trips" ON public.ose_trips;
DROP POLICY IF EXISTS "Supervisors can manage ose_trips of their teams" ON public.ose_trips;

CREATE POLICY "Users can view ose_trips"
ON public.ose_trips
FOR SELECT
TO authenticated
USING (
  public.is_ose_owner(ose_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR team_id IN (SELECT public.get_user_team_ids(auth.uid()))
);

CREATE POLICY "Users can insert ose_trips"
ON public.ose_trips
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_ose_owner(ose_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR team_id IN (SELECT public.get_user_team_ids(auth.uid()))
);

CREATE POLICY "Users can update ose_trips"
ON public.ose_trips
FOR UPDATE
TO authenticated
USING (
  public.is_ose_owner(ose_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR team_id IN (SELECT public.get_user_team_ids(auth.uid()))
);

CREATE POLICY "Users can delete ose_trips"
ON public.ose_trips
FOR DELETE
TO authenticated
USING (
  public.is_ose_owner(ose_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

-- Drop and recreate ose_items policies  
DROP POLICY IF EXISTS "Users can manage ose items" ON public.ose_items;
DROP POLICY IF EXISTS "Users can view ose items" ON public.ose_items;

CREATE POLICY "Users can view ose_items"
ON public.ose_items
FOR SELECT
TO authenticated
USING (
  public.can_access_ose(ose_id, auth.uid())
);

CREATE POLICY "Users can insert ose_items"
ON public.ose_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_ose(ose_id, auth.uid())
);

CREATE POLICY "Users can update ose_items"
ON public.ose_items
FOR UPDATE
TO authenticated
USING (
  public.can_access_ose(ose_id, auth.uid())
);

CREATE POLICY "Users can delete ose_items"
ON public.ose_items
FOR DELETE
TO authenticated
USING (
  public.can_access_ose(ose_id, auth.uid())
);

-- Drop and recreate ose_teams policies
DROP POLICY IF EXISTS "Users can manage ose teams" ON public.ose_teams;
DROP POLICY IF EXISTS "Users can view ose teams" ON public.ose_teams;

CREATE POLICY "Users can view ose_teams"
ON public.ose_teams
FOR SELECT
TO authenticated
USING (public.can_access_ose(ose_id, auth.uid()));

CREATE POLICY "Users can insert ose_teams"
ON public.ose_teams
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_ose(ose_id, auth.uid()));

CREATE POLICY "Users can update ose_teams"
ON public.ose_teams
FOR UPDATE
TO authenticated
USING (public.can_access_ose(ose_id, auth.uid()));

CREATE POLICY "Users can delete ose_teams"
ON public.ose_teams
FOR DELETE
TO authenticated
USING (public.can_access_ose(ose_id, auth.uid()));

-- Drop and recreate ose_dates policies
DROP POLICY IF EXISTS "Users can manage ose dates" ON public.ose_dates;
DROP POLICY IF EXISTS "Users can view ose dates" ON public.ose_dates;

CREATE POLICY "Users can view ose_dates"
ON public.ose_dates
FOR SELECT
TO authenticated
USING (public.can_access_ose(ose_id, auth.uid()));

CREATE POLICY "Users can insert ose_dates"
ON public.ose_dates
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_ose(ose_id, auth.uid()));

CREATE POLICY "Users can update ose_dates"
ON public.ose_dates
FOR UPDATE
TO authenticated
USING (public.can_access_ose(ose_id, auth.uid()));

CREATE POLICY "Users can delete ose_dates"
ON public.ose_dates
FOR DELETE
TO authenticated
USING (public.can_access_ose(ose_id, auth.uid()));