-- Create service catalog table
CREATE TABLE public.service_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  up TEXT NOT NULL,
  service_number TEXT NOT NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  gross_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(up)
);

-- Enable RLS
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

-- Everyone can view service catalog
CREATE POLICY "Anyone can view service catalog"
ON public.service_catalog
FOR SELECT
USING (true);

-- Only admins and gestors can manage
CREATE POLICY "Admins and gestors can manage service catalog"
ON public.service_catalog
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Create OSE (work order) table
CREATE TABLE public.oses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ose_number TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  total_value NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oses ENABLE ROW LEVEL SECURITY;

-- Admins and gestors can manage all OSEs
CREATE POLICY "Admins and gestors can manage all oses"
ON public.oses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Users can view and create their own OSEs
CREATE POLICY "Users can view their own oses"
ON public.oses
FOR SELECT
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Users can create oses"
ON public.oses
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own oses"
ON public.oses
FOR UPDATE
USING (created_by = auth.uid());

-- Create OSE items table
CREATE TABLE public.ose_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ose_id UUID NOT NULL REFERENCES public.oses(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.service_catalog(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ose_items ENABLE ROW LEVEL SECURITY;

-- Items follow OSE permissions
CREATE POLICY "Users can view ose items"
ON public.ose_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.oses 
    WHERE oses.id = ose_items.ose_id 
    AND (oses.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  )
);

CREATE POLICY "Users can manage ose items"
ON public.ose_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.oses 
    WHERE oses.id = ose_items.ose_id 
    AND (oses.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_service_catalog_updated_at
BEFORE UPDATE ON public.service_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_oses_updated_at
BEFORE UPDATE ON public.oses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();