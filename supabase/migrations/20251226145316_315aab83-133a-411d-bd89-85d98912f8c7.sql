-- Add predicted exit date column to workshop_entries
ALTER TABLE public.workshop_entries 
ADD COLUMN predicted_exit_date timestamp with time zone NULL;