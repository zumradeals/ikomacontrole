-- Create caddy_routes table as central domain registry
CREATE TABLE public.caddy_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  infrastructure_id UUID NOT NULL REFERENCES public.infrastructures(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  subdomain TEXT, -- If subdomain is null, it's the root domain
  full_domain TEXT GENERATED ALWAYS AS (CASE WHEN subdomain IS NOT NULL THEN subdomain || '.' || domain ELSE domain END) STORED,
  backend_host TEXT NOT NULL DEFAULT 'localhost',
  backend_port INTEGER NOT NULL DEFAULT 3000,
  backend_protocol TEXT NOT NULL DEFAULT 'http' CHECK (backend_protocol IN ('http', 'https')),
  https_enabled BOOLEAN NOT NULL DEFAULT true,
  https_status TEXT NOT NULL DEFAULT 'pending' CHECK (https_status IN ('pending', 'provisioning', 'ok', 'failed')),
  consumed_by TEXT, -- 'supabase', 'app:<app_name>', 'api:<api_name>', or null if free
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  
  UNIQUE(infrastructure_id, full_domain)
);

-- Enable RLS
ALTER TABLE public.caddy_routes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to view caddy routes" 
  ON public.caddy_routes 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert caddy routes" 
  ON public.caddy_routes 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update caddy routes" 
  ON public.caddy_routes 
  FOR UPDATE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete caddy routes" 
  ON public.caddy_routes 
  FOR DELETE 
  USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_caddy_routes_updated_at
  BEFORE UPDATE ON public.caddy_routes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add domain column to infrastructures table for root domain
ALTER TABLE public.infrastructures 
  ADD COLUMN IF NOT EXISTS root_domain TEXT,
  ADD COLUMN IF NOT EXISTS root_domain_verified BOOLEAN DEFAULT false;

-- Enable realtime for caddy_routes
ALTER PUBLICATION supabase_realtime ADD TABLE public.caddy_routes;