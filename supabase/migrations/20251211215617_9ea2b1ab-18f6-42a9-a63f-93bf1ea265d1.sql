-- Add unique constraint on team_id to enforce 1-to-1 relationship between teams and vehicles
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_team_id_unique UNIQUE (team_id);