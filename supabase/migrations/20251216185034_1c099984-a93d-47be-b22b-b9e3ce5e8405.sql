-- Create team schedules table for monthly schedule control
CREATE TABLE public.team_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  date date NOT NULL,
  is_working boolean NOT NULL DEFAULT true,
  observation text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(team_id, date)
);

-- Enable RLS
ALTER TABLE public.team_schedules ENABLE ROW LEVEL SECURITY;

-- Admin can manage all schedules
CREATE POLICY "Admins can manage all schedules"
ON public.team_schedules
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Supervisors can view schedules of their teams
CREATE POLICY "Supervisors can view schedules of their teams"
ON public.team_schedules
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  team_id IN (SELECT get_user_team_ids(auth.uid()))
);

-- Supervisors can insert schedules for their teams
CREATE POLICY "Supervisors can insert schedules for their teams"
ON public.team_schedules
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  team_id IN (SELECT get_user_team_ids(auth.uid()))
);

-- Supervisors can update schedules of their teams
CREATE POLICY "Supervisors can update schedules of their teams"
ON public.team_schedules
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  team_id IN (SELECT get_user_team_ids(auth.uid()))
);

-- Supervisors can delete schedules of their teams
CREATE POLICY "Supervisors can delete schedules of their teams"
ON public.team_schedules
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  team_id IN (SELECT get_user_team_ids(auth.uid()))
);

-- Create trigger for updated_at
CREATE TRIGGER update_team_schedules_updated_at
BEFORE UPDATE ON public.team_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();