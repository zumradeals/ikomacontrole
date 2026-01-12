-- Enum types for deployments
CREATE TYPE public.deployment_status AS ENUM (
  'draft', 
  'planning', 
  'ready', 
  'running', 
  'applied', 
  'failed', 
  'rolled_back'
);

CREATE TYPE public.deployment_type AS ENUM (
  'nodejs',
  'docker_compose', 
  'static_site',
  'custom'
);

CREATE TYPE public.deployment_step_type AS ENUM (
  'clone_repo',
  'checkout',
  'env_write',
  'install_deps',
  'build',
  'start',
  'healthcheck',
  'expose',
  'finalize',
  'stop',
  'rollback',
  'custom'
);

CREATE TYPE public.deployment_step_status AS ENUM (
  'pending',
  'running', 
  'applied',
  'failed',
  'skipped'
);

CREATE TYPE public.healthcheck_type AS ENUM (
  'http',
  'tcp',
  'command'
);

-- Main deployments table
CREATE TABLE public.deployments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  deploy_type deployment_type NOT NULL DEFAULT 'nodejs',
  runner_id UUID NOT NULL REFERENCES public.runners(id) ON DELETE CASCADE,
  infrastructure_id UUID REFERENCES public.infrastructures(id) ON DELETE SET NULL,
  status deployment_status NOT NULL DEFAULT 'draft',
  current_step TEXT,
  working_dir TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  healthcheck_type healthcheck_type NOT NULL DEFAULT 'http',
  healthcheck_value TEXT,
  port INTEGER DEFAULT 3000,
  start_command TEXT,
  env_vars JSONB DEFAULT '{}'::jsonb,
  expose_via_caddy BOOLEAN DEFAULT false,
  domain TEXT,
  rolled_back_from UUID REFERENCES public.deployments(id),
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Deployment steps table
CREATE TABLE public.deployment_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deployment_id UUID NOT NULL REFERENCES public.deployments(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type deployment_step_type NOT NULL,
  step_name TEXT NOT NULL,
  command TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  status deployment_step_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  stdout_tail TEXT,
  stderr_tail TEXT,
  exit_code INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(deployment_id, step_order)
);

-- Indexes
CREATE INDEX idx_deployments_runner ON public.deployments(runner_id);
CREATE INDEX idx_deployments_infra ON public.deployments(infrastructure_id);
CREATE INDEX idx_deployments_status ON public.deployments(status);
CREATE INDEX idx_deployments_app ON public.deployments(app_name);
CREATE INDEX idx_deployment_steps_deployment ON public.deployment_steps(deployment_id);
CREATE INDEX idx_deployment_steps_order ON public.deployment_steps(order_id);
CREATE INDEX idx_deployment_steps_status ON public.deployment_steps(status);

-- Enable RLS
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deployments
CREATE POLICY "Authenticated users can view deployments"
ON public.deployments FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create deployments"
ON public.deployments FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update deployments"
ON public.deployments FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete deployments"
ON public.deployments FOR DELETE
USING (auth.uid() IS NOT NULL);

-- RLS Policies for deployment_steps
CREATE POLICY "Authenticated users can view deployment_steps"
ON public.deployment_steps FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create deployment_steps"
ON public.deployment_steps FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update deployment_steps"
ON public.deployment_steps FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete deployment_steps"
ON public.deployment_steps FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Triggers for updated_at
CREATE TRIGGER update_deployments_updated_at
BEFORE UPDATE ON public.deployments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deployment_steps_updated_at
BEFORE UPDATE ON public.deployment_steps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();