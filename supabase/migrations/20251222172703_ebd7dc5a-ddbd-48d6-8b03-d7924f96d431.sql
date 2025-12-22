-- Update teams policies to include gestor
DROP POLICY IF EXISTS "Admins can manage all teams" ON public.teams;
CREATE POLICY "Admins and gestors can manage all teams" 
ON public.teams FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Update vehicles policies
DROP POLICY IF EXISTS "Admins can manage all vehicles" ON public.vehicles;
CREATE POLICY "Admins and gestors can manage all vehicles" 
ON public.vehicles FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Update drivers policies
DROP POLICY IF EXISTS "Admins can manage all drivers" ON public.drivers;
CREATE POLICY "Admins and gestors can manage all drivers" 
ON public.drivers FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Update departures policies
DROP POLICY IF EXISTS "Admins can manage all departures" ON public.departures;
CREATE POLICY "Admins and gestors can manage all departures" 
ON public.departures FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Update allocations policies
DROP POLICY IF EXISTS "Admins can manage all allocations" ON public.allocations;
CREATE POLICY "Admins and gestors can manage all allocations" 
ON public.allocations FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Update incidents policies
DROP POLICY IF EXISTS "Admins can manage all incidents" ON public.incidents;
CREATE POLICY "Admins and gestors can manage all incidents" 
ON public.incidents FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Update maintenance_records policies
DROP POLICY IF EXISTS "Admins can manage all maintenance" ON public.maintenance_records;
CREATE POLICY "Admins and gestors can manage all maintenance" 
ON public.maintenance_records FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Update workshop_entries policies
DROP POLICY IF EXISTS "Admins can manage all workshop entries" ON public.workshop_entries;
CREATE POLICY "Admins and gestors can manage all workshop entries" 
ON public.workshop_entries FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Update team_schedules policies
DROP POLICY IF EXISTS "Admins can manage all schedules" ON public.team_schedules;
CREATE POLICY "Admins and gestors can manage all schedules" 
ON public.team_schedules FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Update supervisor_teams policies
DROP POLICY IF EXISTS "Admins can manage supervisor_teams" ON public.supervisor_teams;
CREATE POLICY "Admins and gestors can manage supervisor_teams" 
ON public.supervisor_teams FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));