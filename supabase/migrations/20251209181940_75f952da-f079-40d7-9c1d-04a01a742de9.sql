-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor');

-- Create team type enum
CREATE TYPE public.team_type AS ENUM ('linha_viva', 'linha_morta', 'poda', 'linha_morta_obras');

-- Create vehicle status enum
CREATE TYPE public.vehicle_status AS ENUM ('ativo', 'manutencao', 'reserva', 'oficina');

-- Create incident type enum
CREATE TYPE public.incident_type AS ENUM ('multa', 'acidente', 'incidente', 'observacao');

-- Create incident severity enum
CREATE TYPE public.incident_severity AS ENUM ('baixa', 'media', 'alta', 'critica');

-- Create maintenance status enum
CREATE TYPE public.maintenance_status AS ENUM ('pendente', 'em_andamento', 'concluida');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type team_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create supervisor_teams junction table (many-to-many)
CREATE TABLE public.supervisor_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supervisor_id, team_id)
);

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  year INTEGER,
  status vehicle_status NOT NULL DEFAULT 'ativo',
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create drivers table
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  matricula TEXT NOT NULL UNIQUE,
  funcao TEXT NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  contato TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create maintenance_records table
CREATE TABLE public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  cost DECIMAL(10,2),
  scheduled_date DATE,
  completed_date DATE,
  scheduled_km INTEGER,
  status maintenance_status NOT NULL DEFAULT 'pendente',
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create workshop_entries table (entrada/saída oficina)
CREATE TABLE public.workshop_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  entry_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_date TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status maintenance_status NOT NULL DEFAULT 'em_andamento',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create incidents table
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type incident_type NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  severity incident_severity NOT NULL DEFAULT 'media',
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create allocations table
CREATE TABLE public.allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  checkout_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return TIMESTAMPTZ,
  actual_return TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'em_uso',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create security definer function to get user's team IDs
CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.supervisor_teams
  WHERE supervisor_id = _user_id
$$;

-- Create security definer function to check if user can access team
CREATE OR REPLACE FUNCTION public.can_access_team(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(_user_id, 'admin') 
    OR EXISTS (
      SELECT 1 
      FROM public.supervisor_teams 
      WHERE supervisor_id = _user_id 
        AND team_id = _team_id
    )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Teams policies
CREATE POLICY "Admins can manage all teams"
  ON public.teams FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisors can view their teams"
  ON public.teams FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR id IN (SELECT public.get_user_team_ids(auth.uid()))
  );

-- Supervisor teams policies
CREATE POLICY "Admins can manage supervisor_teams"
  ON public.supervisor_teams FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisors can view their own assignments"
  ON public.supervisor_teams FOR SELECT
  TO authenticated
  USING (supervisor_id = auth.uid());

-- Vehicles policies
CREATE POLICY "Admins can manage all vehicles"
  ON public.vehicles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisors can view vehicles of their teams"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  );

CREATE POLICY "Supervisors can update vehicles of their teams"
  ON public.vehicles FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  );

-- Drivers policies
CREATE POLICY "Admins can manage all drivers"
  ON public.drivers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisors can view drivers of their teams"
  ON public.drivers FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  );

CREATE POLICY "Supervisors can update drivers of their teams"
  ON public.drivers FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  );

-- Maintenance records policies
CREATE POLICY "Admins can manage all maintenance"
  ON public.maintenance_records FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisors can view maintenance of their team vehicles"
  ON public.maintenance_records FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR vehicle_id IN (
      SELECT id FROM public.vehicles 
      WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))
    )
  );

CREATE POLICY "Supervisors can manage maintenance of their team vehicles"
  ON public.maintenance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR vehicle_id IN (
      SELECT id FROM public.vehicles 
      WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))
    )
  );

CREATE POLICY "Supervisors can update maintenance of their team vehicles"
  ON public.maintenance_records FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR vehicle_id IN (
      SELECT id FROM public.vehicles 
      WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))
    )
  );

-- Workshop entries policies
CREATE POLICY "Admins can manage all workshop entries"
  ON public.workshop_entries FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisors can view workshop entries of their team vehicles"
  ON public.workshop_entries FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR vehicle_id IN (
      SELECT id FROM public.vehicles 
      WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))
    )
  );

CREATE POLICY "Supervisors can manage workshop entries of their team vehicles"
  ON public.workshop_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR vehicle_id IN (
      SELECT id FROM public.vehicles 
      WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))
    )
  );

CREATE POLICY "Supervisors can update workshop entries of their team vehicles"
  ON public.workshop_entries FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR vehicle_id IN (
      SELECT id FROM public.vehicles 
      WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))
    )
  );

-- Incidents policies
CREATE POLICY "Admins can manage all incidents"
  ON public.incidents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisors can view incidents of their team vehicles"
  ON public.incidents FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR vehicle_id IN (
      SELECT id FROM public.vehicles 
      WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))
    )
  );

CREATE POLICY "Supervisors can manage incidents of their team vehicles"
  ON public.incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR vehicle_id IN (
      SELECT id FROM public.vehicles 
      WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))
    )
  );

-- Allocations policies
CREATE POLICY "Admins can manage all allocations"
  ON public.allocations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisors can view allocations of their team vehicles"
  ON public.allocations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR vehicle_id IN (
      SELECT id FROM public.vehicles 
      WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))
    )
  );

CREATE POLICY "Supervisors can manage allocations of their team vehicles"
  ON public.allocations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR vehicle_id IN (
      SELECT id FROM public.vehicles 
      WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))
    )
  );

CREATE POLICY "Supervisors can update allocations of their team vehicles"
  ON public.allocations FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR vehicle_id IN (
      SELECT id FROM public.vehicles 
      WHERE team_id IN (SELECT public.get_user_team_ids(auth.uid()))
    )
  );

-- Create trigger to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers to all tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_records_updated_at
  BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workshop_entries_updated_at
  BEFORE UPDATE ON public.workshop_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_allocations_updated_at
  BEFORE UPDATE ON public.allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

-- Storage policies for attachments
CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Anyone can view attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY "Users can delete their attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');