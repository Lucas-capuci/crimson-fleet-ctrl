-- Create productivity_entries table for tracking programado, executado, and validado values
CREATE TABLE public.productivity_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('programado', 'executado', 'validado_eqtl')),
  value NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, date, entry_type)
);

-- Enable Row Level Security
ALTER TABLE public.productivity_entries ENABLE ROW LEVEL SECURITY;

-- Create policies for productivity_entries (corrected parameter order for has_role)
CREATE POLICY "Users can view productivity entries"
ON public.productivity_entries
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'gestor'::public.app_role) OR
  public.can_access_team(auth.uid(), team_id)
);

CREATE POLICY "Users can create productivity entries"
ON public.productivity_entries
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'gestor'::public.app_role) OR
  public.can_access_team(auth.uid(), team_id)
);

CREATE POLICY "Users can update productivity entries"
ON public.productivity_entries
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'gestor'::public.app_role) OR
  public.can_access_team(auth.uid(), team_id)
);

CREATE POLICY "Users can delete productivity entries"
ON public.productivity_entries
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'gestor'::public.app_role)
);

-- Create index for better query performance
CREATE INDEX idx_productivity_entries_team_date ON public.productivity_entries(team_id, date);
CREATE INDEX idx_productivity_entries_date ON public.productivity_entries(date);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_productivity_entries_updated_at
BEFORE UPDATE ON public.productivity_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();