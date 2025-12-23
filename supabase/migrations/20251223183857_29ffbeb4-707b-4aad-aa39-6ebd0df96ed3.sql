-- Create production_data table
CREATE TABLE public.production_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  production_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, date)
);

-- Indexes for performance
CREATE INDEX idx_production_data_date ON public.production_data(date);
CREATE INDEX idx_production_data_team_id ON public.production_data(team_id);

-- Enable RLS
ALTER TABLE public.production_data ENABLE ROW LEVEL SECURITY;

-- Admins and gestors can manage all production data
CREATE POLICY "Admins e gestores podem gerenciar produção"
ON public.production_data FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

-- Supervisors can view production data for their teams
CREATE POLICY "Supervisores podem ver produção de suas equipes"
ON public.production_data FOR SELECT
USING (team_id IN (SELECT get_user_team_ids(auth.uid())));

-- Trigger for updated_at
CREATE TRIGGER update_production_data_updated_at
BEFORE UPDATE ON public.production_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();