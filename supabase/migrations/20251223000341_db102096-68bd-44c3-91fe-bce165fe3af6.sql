-- Add scheduled entry and exit time columns to teams table
ALTER TABLE public.teams 
ADD COLUMN scheduled_entry_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '07:00:00',
ADD COLUMN scheduled_exit_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '17:00:00';