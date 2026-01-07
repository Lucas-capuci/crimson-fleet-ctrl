-- Add team_id and date columns to oses table
ALTER TABLE public.oses 
ADD COLUMN team_id UUID REFERENCES public.teams(id),
ADD COLUMN date DATE;

-- Create permission profile for budget access if not exists
INSERT INTO public.permission_profiles (name, description, is_system)
VALUES ('Orçamento', 'Acesso à aba de Orçamento', false)
ON CONFLICT DO NOTHING;

-- Get the profile id for Orçamento
DO $$
DECLARE
  profile_uuid UUID;
BEGIN
  SELECT id INTO profile_uuid FROM public.permission_profiles WHERE name = 'Orçamento';
  
  -- Add view permission for budget page
  INSERT INTO public.profile_permissions (profile_id, page, action)
  VALUES 
    (profile_uuid, 'budget', 'view'),
    (profile_uuid, 'budget', 'create'),
    (profile_uuid, 'budget', 'edit')
  ON CONFLICT DO NOTHING;
END $$;

-- Assign budget permission to Clayton
INSERT INTO public.user_permissions (user_id, profile_id)
SELECT '15d6ea15-079c-41ef-952f-18308e8a574e', id 
FROM public.permission_profiles WHERE name = 'Orçamento'
ON CONFLICT DO NOTHING;

-- Assign budget permission to Kesley  
INSERT INTO public.user_permissions (user_id, profile_id)
SELECT 'd5588214-95ff-4ece-8cf5-c3c05beb37a7', id 
FROM public.permission_profiles WHERE name = 'Orçamento'
ON CONFLICT DO NOTHING;

-- Assign budget permission to kesley gregorio
INSERT INTO public.user_permissions (user_id, profile_id)
SELECT '27abe19c-9d3e-4dd5-93ed-b05265bae9e1', id 
FROM public.permission_profiles WHERE name = 'Orçamento'
ON CONFLICT DO NOTHING;