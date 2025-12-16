-- Remove existing supervisor policies that allow editing
DROP POLICY IF EXISTS "Supervisors can insert schedules for their teams" ON public.team_schedules;
DROP POLICY IF EXISTS "Supervisors can update schedules of their teams" ON public.team_schedules;
DROP POLICY IF EXISTS "Supervisors can delete schedules of their teams" ON public.team_schedules;

-- Supervisor can only view schedules of their teams (no insert/update/delete)
-- The existing SELECT policy remains unchanged