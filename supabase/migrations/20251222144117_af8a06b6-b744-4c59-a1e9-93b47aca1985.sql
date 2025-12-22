-- Add field to teams to control if it appears in departures
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS show_in_departures boolean NOT NULL DEFAULT true;

-- Create enum for permissions
CREATE TYPE public.permission_action AS ENUM ('view', 'create', 'edit', 'delete', 'export');

-- Create table for permission profiles (pre-defined roles like supervisor, operator, viewer)
CREATE TABLE public.permission_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create table for profile permissions (what each profile can do)
CREATE TABLE public.profile_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.permission_profiles(id) ON DELETE CASCADE,
  page text NOT NULL,
  action permission_action NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, page, action)
);

-- Create table for user permission assignments
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.permission_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Create table for user custom permissions (overrides profile permissions)
CREATE TABLE public.user_custom_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page text NOT NULL,
  action permission_action NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page, action)
);

-- Enable RLS on all new tables
ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permission_profiles
CREATE POLICY "Anyone can view permission profiles" ON public.permission_profiles
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage permission profiles" ON public.permission_profiles
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for profile_permissions
CREATE POLICY "Anyone can view profile permissions" ON public.profile_permissions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage profile permissions" ON public.profile_permissions
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for user_permissions
CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage user permissions" ON public.user_permissions
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for user_custom_permissions
CREATE POLICY "Users can view own custom permissions" ON public.user_custom_permissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage user custom permissions" ON public.user_custom_permissions
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Insert default permission profiles
INSERT INTO public.permission_profiles (name, description, is_system) VALUES
  ('Administrador', 'Acesso total ao sistema', true),
  ('Supervisor', 'Visualiza e gerencia apenas as equipes vinculadas', true),
  ('Visualizador', 'Apenas visualização, sem edição', true),
  ('Operador', 'Pode visualizar e editar, mas não excluir', true);

-- Get the profile IDs for inserting permissions
WITH profiles AS (
  SELECT id, name FROM public.permission_profiles
)
INSERT INTO public.profile_permissions (profile_id, page, action)
SELECT p.id, pages.page, actions.action
FROM profiles p
CROSS JOIN (VALUES 
  ('dashboard'), ('vehicles'), ('drivers'), ('teams'), ('departures'), 
  ('maintenance'), ('incidents'), ('schedule'), ('workshop'), ('admin')
) AS pages(page)
CROSS JOIN (VALUES 
  ('view'::permission_action), ('create'::permission_action), ('edit'::permission_action), 
  ('delete'::permission_action), ('export'::permission_action)
) AS actions(action)
WHERE p.name = 'Administrador';

-- Supervisor permissions (view, create, edit, export - no delete, no admin)
WITH profiles AS (
  SELECT id FROM public.permission_profiles WHERE name = 'Supervisor'
)
INSERT INTO public.profile_permissions (profile_id, page, action)
SELECT p.id, pages.page, actions.action
FROM profiles p
CROSS JOIN (VALUES 
  ('dashboard'), ('vehicles'), ('drivers'), ('teams'), ('departures'), 
  ('maintenance'), ('incidents'), ('schedule'), ('workshop')
) AS pages(page)
CROSS JOIN (VALUES 
  ('view'::permission_action), ('create'::permission_action), ('edit'::permission_action), ('export'::permission_action)
) AS actions(action);

-- Visualizador permissions (view and export only)
WITH profiles AS (
  SELECT id FROM public.permission_profiles WHERE name = 'Visualizador'
)
INSERT INTO public.profile_permissions (profile_id, page, action)
SELECT p.id, pages.page, actions.action
FROM profiles p
CROSS JOIN (VALUES 
  ('dashboard'), ('vehicles'), ('drivers'), ('teams'), ('departures'), 
  ('maintenance'), ('incidents'), ('schedule'), ('workshop')
) AS pages(page)
CROSS JOIN (VALUES 
  ('view'::permission_action), ('export'::permission_action)
) AS actions(action);

-- Operador permissions (view, create, edit, export - no delete)
WITH profiles AS (
  SELECT id FROM public.permission_profiles WHERE name = 'Operador'
)
INSERT INTO public.profile_permissions (profile_id, page, action)
SELECT p.id, pages.page, actions.action
FROM profiles p
CROSS JOIN (VALUES 
  ('dashboard'), ('vehicles'), ('drivers'), ('teams'), ('departures'), 
  ('maintenance'), ('incidents'), ('schedule'), ('workshop')
) AS pages(page)
CROSS JOIN (VALUES 
  ('view'::permission_action), ('create'::permission_action), ('edit'::permission_action), ('export'::permission_action)
) AS actions(action);

-- Create function to check user permission
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _page text, _action permission_action)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admins have all permissions
  SELECT CASE 
    WHEN has_role(_user_id, 'admin') THEN true
    ELSE (
      -- Check custom permissions first (overrides)
      SELECT COALESCE(
        (SELECT allowed FROM user_custom_permissions WHERE user_id = _user_id AND page = _page AND action = _action),
        -- Fall back to profile permissions
        EXISTS (
          SELECT 1 
          FROM user_permissions up
          JOIN profile_permissions pp ON pp.profile_id = up.profile_id
          WHERE up.user_id = _user_id AND pp.page = _page AND pp.action = _action
        )
      )
    )
  END
$$;

-- Trigger for updated_at
CREATE TRIGGER update_permission_profiles_updated_at
  BEFORE UPDATE ON public.permission_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();