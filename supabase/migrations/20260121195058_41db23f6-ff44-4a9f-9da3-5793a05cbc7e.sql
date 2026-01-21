-- Add laudo (certification) date fields to vehicles table
ALTER TABLE public.vehicles
ADD COLUMN laudo_eletrico DATE,
ADD COLUMN laudo_acustico DATE,
ADD COLUMN laudo_liner DATE,
ADD COLUMN laudo_tacografo DATE;