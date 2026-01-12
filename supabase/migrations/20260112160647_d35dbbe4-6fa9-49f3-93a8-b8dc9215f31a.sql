-- Table to store Platform service instances (Supabase, Redis, etc.)
CREATE TABLE public.platform_instances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    infrastructure_id uuid REFERENCES public.infrastructures(id) ON DELETE CASCADE NOT NULL,
    service_type text NOT NULL, -- 'supabase', 'redis', 'prometheus', etc.
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'installed', 'failed', 'stopped'
    
    -- Supabase-specific credentials
    supabase_url text,
    supabase_anon_key text,
    supabase_service_role_key text, -- Sensitive! Only for backend use
    supabase_project_ref text,
    supabase_jwt_secret text,
    supabase_postgres_password text,
    
    -- Generic config for other services
    config jsonb DEFAULT '{}'::jsonb,
    
    -- Metadata
    domain text,
    port integer,
    installed_at timestamp with time zone,
    last_verified_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    -- Unique constraint: one instance per service per infrastructure
    UNIQUE (infrastructure_id, service_type)
);

-- Enable RLS
ALTER TABLE public.platform_instances ENABLE ROW LEVEL SECURITY;

-- Policies: Authenticated users can manage platform instances
CREATE POLICY "Authenticated users can view platform_instances"
ON public.platform_instances
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create platform_instances"
ON public.platform_instances
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update platform_instances"
ON public.platform_instances
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete platform_instances"
ON public.platform_instances
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_platform_instances_updated_at
    BEFORE UPDATE ON public.platform_instances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Comment on sensitive columns
COMMENT ON COLUMN public.platform_instances.supabase_service_role_key IS 'SENSITIVE: Only use in backend/edge functions, never expose to frontend';
COMMENT ON COLUMN public.platform_instances.supabase_jwt_secret IS 'SENSITIVE: JWT secret for Supabase auth';
COMMENT ON COLUMN public.platform_instances.supabase_postgres_password IS 'SENSITIVE: Postgres database password';