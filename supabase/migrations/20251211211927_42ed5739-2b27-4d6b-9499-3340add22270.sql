-- Add cost_center column to teams table
ALTER TABLE public.teams ADD COLUMN cost_center varchar(6);

-- Add comment for documentation
COMMENT ON COLUMN public.teams.cost_center IS 'Centro de custo - 6 dígitos';