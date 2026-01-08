
-- Create ose_trips table (idas) - combines team + date + items
CREATE TABLE public.ose_trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ose_id UUID NOT NULL REFERENCES public.oses(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id),
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ose_trips ENABLE ROW LEVEL SECURITY;

-- RLS policies for ose_trips
CREATE POLICY "Admins and gestors can manage all ose_trips" 
ON public.ose_trips 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Users can manage their own ose_trips" 
ON public.ose_trips 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM oses WHERE oses.id = ose_trips.ose_id AND oses.created_by = auth.uid()
));

CREATE POLICY "Supervisors can manage ose_trips of their teams" 
ON public.ose_trips 
FOR ALL 
USING (team_id IN (SELECT get_user_team_ids(auth.uid())));

-- Add trip_id to ose_items table
ALTER TABLE public.ose_items ADD COLUMN trip_id UUID REFERENCES public.ose_trips(id) ON DELETE CASCADE;

-- Update RLS policies on oses to allow supervisors to create/manage
DROP POLICY IF EXISTS "Users can create oses" ON public.oses;
DROP POLICY IF EXISTS "Users can update their own oses" ON public.oses;
DROP POLICY IF EXISTS "Users can view their own oses" ON public.oses;

-- Recreate OSE policies to include supervisors
CREATE POLICY "Users can create oses" 
ON public.oses 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own oses" 
ON public.oses 
FOR UPDATE 
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Users can view oses" 
ON public.oses 
FOR SELECT 
USING (
  created_by = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR EXISTS (
    SELECT 1 FROM ose_trips WHERE ose_trips.ose_id = oses.id AND ose_trips.team_id IN (SELECT get_user_team_ids(auth.uid()))
  )
);

-- Update ose_items RLS to work with trips
DROP POLICY IF EXISTS "Users can manage ose items" ON public.ose_items;
DROP POLICY IF EXISTS "Users can view ose items" ON public.ose_items;

CREATE POLICY "Users can view ose items" 
ON public.ose_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM oses 
    WHERE oses.id = ose_items.ose_id 
    AND (
      oses.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'gestor'::app_role)
    )
  )
  OR EXISTS (
    SELECT 1 FROM ose_trips 
    WHERE ose_trips.id = ose_items.trip_id 
    AND ose_trips.team_id IN (SELECT get_user_team_ids(auth.uid()))
  )
);

CREATE POLICY "Users can manage ose items" 
ON public.ose_items 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM oses 
    WHERE oses.id = ose_items.ose_id 
    AND (
      oses.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'gestor'::app_role)
    )
  )
  OR EXISTS (
    SELECT 1 FROM ose_trips 
    WHERE ose_trips.id = ose_items.trip_id 
    AND ose_trips.team_id IN (SELECT get_user_team_ids(auth.uid()))
  )
);

-- Create index for better performance
CREATE INDEX idx_ose_trips_ose_id ON public.ose_trips(ose_id);
CREATE INDEX idx_ose_trips_team_id ON public.ose_trips(team_id);
CREATE INDEX idx_ose_trips_date ON public.ose_trips(date);
CREATE INDEX idx_ose_items_trip_id ON public.ose_items(trip_id);
