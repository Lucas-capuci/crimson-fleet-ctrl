-- Add scheduled entry and exit times to team_schedules with defaults of 07:00 and 17:00
ALTER TABLE public.team_schedules
ADD COLUMN scheduled_entry_time time without time zone NOT NULL DEFAULT '07:00:00',
ADD COLUMN scheduled_exit_time time without time zone NOT NULL DEFAULT '17:00:00';