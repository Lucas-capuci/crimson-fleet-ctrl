-- Drop the restrictive teams SELECT policy
DROP POLICY IF EXISTS "Supervisors can view their teams" ON teams;

-- Create permissive policy for teams - any authenticated user can view all teams
CREATE POLICY "Authenticated users can view all teams"
ON teams FOR SELECT TO authenticated
USING (true);