-- Create departures table
CREATE TABLE public.departures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  departed BOOLEAN NOT NULL DEFAULT false,
  departure_time TIME,
  no_departure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, date)
);

-- Enable RLS
ALTER TABLE public.departures ENABLE ROW LEVEL SECURITY;

-- Admin can manage all departures
CREATE POLICY "Admins can manage all departures"
ON public.departures
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Supervisors can view departures they created
CREATE POLICY "Supervisors can view their departures"
ON public.departures
FOR SELECT
USING (supervisor_id = auth.uid());

-- Supervisors can insert departures for their teams
CREATE POLICY "Supervisors can insert departures for their teams"
ON public.departures
FOR INSERT
WITH CHECK (
  supervisor_id = auth.uid() AND
  team_id IN (SELECT get_user_team_ids(auth.uid()))
);

-- Supervisors can update their own departures
CREATE POLICY "Supervisors can update their departures"
ON public.departures
FOR UPDATE
USING (supervisor_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_departures_updated_at
  BEFORE UPDATE ON public.departures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();