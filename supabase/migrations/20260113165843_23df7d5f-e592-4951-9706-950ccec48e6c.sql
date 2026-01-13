-- Drop the restrictive ose_trips policies
DROP POLICY IF EXISTS "Users can insert ose_trips" ON ose_trips;
DROP POLICY IF EXISTS "Users can update ose_trips" ON ose_trips;
DROP POLICY IF EXISTS "Users can view ose_trips" ON ose_trips;
DROP POLICY IF EXISTS "Users can delete ose_trips" ON ose_trips;

-- Create permissive policies for ose_trips - any authenticated user with OSE access can manage trips for any team
CREATE POLICY "Users can view ose_trips"
ON ose_trips FOR SELECT
USING (can_access_ose(ose_id, auth.uid()));

CREATE POLICY "Users can insert ose_trips"
ON ose_trips FOR INSERT
WITH CHECK (can_access_ose(ose_id, auth.uid()));

CREATE POLICY "Users can update ose_trips"
ON ose_trips FOR UPDATE
USING (can_access_ose(ose_id, auth.uid()));

CREATE POLICY "Users can delete ose_trips"
ON ose_trips FOR DELETE
USING (can_access_ose(ose_id, auth.uid()));