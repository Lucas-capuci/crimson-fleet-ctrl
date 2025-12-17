-- Update get_email_by_username function to be case-insensitive
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM profiles WHERE LOWER(username) = LOWER(_username) LIMIT 1;
$$;