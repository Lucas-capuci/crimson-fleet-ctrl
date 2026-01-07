-- Create junction table for OSE to Teams (many-to-many)
CREATE TABLE public.ose_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ose_id UUID NOT NULL REFERENCES public.oses(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ose_id, team_id)
);

-- Create junction table for OSE to Dates (many-to-many)
CREATE TABLE public.ose_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ose_id UUID NOT NULL REFERENCES public.oses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ose_id, date)
);

-- Enable RLS
ALTER TABLE public.ose_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ose_dates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ose_teams
CREATE POLICY "Users can view ose teams" ON public.ose_teams
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM oses WHERE oses.id = ose_teams.ose_id 
    AND (oses.created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  )
);

CREATE POLICY "Users can manage ose teams" ON public.ose_teams
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM oses WHERE oses.id = ose_teams.ose_id 
    AND (oses.created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  )
);

-- RLS Policies for ose_dates
CREATE POLICY "Users can view ose dates" ON public.ose_dates
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM oses WHERE oses.id = ose_dates.ose_id 
    AND (oses.created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  )
);

CREATE POLICY "Users can manage ose dates" ON public.ose_dates
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM oses WHERE oses.id = ose_dates.ose_id 
    AND (oses.created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  )
);