-- Enum pour le statut du workflow de publication
CREATE TYPE public.playbook_status AS ENUM (
  'draft',
  'pending_review', 
  'approved',
  'staging_test',
  'published',
  'rejected',
  'test_failed',
  'archived'
);

-- Enum pour le type de runtime
CREATE TYPE public.playbook_runtime AS ENUM ('bash', 'python', 'node');

-- Enum pour le niveau de risque
CREATE TYPE public.playbook_risk_level AS ENUM ('low', 'medium', 'high', 'critical');

-- Table principale des playbooks (source locale de vérité)
CREATE TABLE public.playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'custom',
  runtime playbook_runtime NOT NULL DEFAULT 'bash',
  entrypoint TEXT NOT NULL,
  schema JSONB DEFAULT '{}'::jsonb,
  timeout_sec INTEGER DEFAULT 300,
  workdir TEXT DEFAULT '/opt/ikoma',
  risk_level playbook_risk_level DEFAULT 'medium',
  effects TEXT[] DEFAULT '{}',
  requirements TEXT[] DEFAULT '{}',
  visibility TEXT DEFAULT 'private',
  status playbook_status NOT NULL DEFAULT 'draft',
  current_version INTEGER DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Versions des playbooks (historique Git-like)
CREATE TABLE public.playbook_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  runtime playbook_runtime NOT NULL,
  entrypoint TEXT NOT NULL,
  schema JSONB DEFAULT '{}'::jsonb,
  timeout_sec INTEGER DEFAULT 300,
  workdir TEXT,
  risk_level playbook_risk_level,
  effects TEXT[] DEFAULT '{}',
  requirements TEXT[] DEFAULT '{}',
  changelog TEXT,
  diff_from_previous JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(playbook_id, version)
);

-- Templates marketplace
CREATE TABLE public.playbook_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  runtime playbook_runtime NOT NULL DEFAULT 'bash',
  entrypoint_template TEXT NOT NULL,
  schema JSONB DEFAULT '{}'::jsonb,
  default_config JSONB DEFAULT '{}'::jsonb,
  risk_level playbook_risk_level DEFAULT 'medium',
  effects TEXT[] DEFAULT '{}',
  requirements TEXT[] DEFAULT '{}',
  icon TEXT,
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  rating_avg NUMERIC(2,1) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  is_official BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bibliothèque de scripts uploadés
CREATE TABLE public.playbook_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  runtime playbook_runtime NOT NULL,
  content TEXT,
  size_bytes INTEGER,
  checksum TEXT,
  infrastructure_id UUID REFERENCES public.infrastructures(id) ON DELETE CASCADE,
  is_synced BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(infrastructure_id, path)
);

-- Workflow d'approbation
CREATE TABLE public.playbook_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  reviewer_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  comments TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Audit trail des exécutions
CREATE TABLE public.playbook_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID REFERENCES public.playbooks(id) ON DELETE SET NULL,
  playbook_key TEXT NOT NULL,
  playbook_version INTEGER,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  infrastructure_id UUID REFERENCES public.infrastructures(id) ON DELETE SET NULL,
  runner_id UUID,
  input_params JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  exit_code INTEGER,
  stdout_tail TEXT,
  stderr_tail TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  executed_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sandbox de test
CREATE TABLE public.playbook_test_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  infrastructure_id UUID REFERENCES public.infrastructures(id),
  input_params JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  duration_ms INTEGER,
  tested_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_test_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for playbooks
CREATE POLICY "Authenticated can view playbooks" ON public.playbooks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operators can create playbooks" ON public.playbooks
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
  );

CREATE POLICY "Operators can update playbooks" ON public.playbooks
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND 
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
  );

CREATE POLICY "Admins can delete playbooks" ON public.playbooks
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS for versions
CREATE POLICY "Authenticated can view versions" ON public.playbook_versions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operators can create versions" ON public.playbook_versions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
  );

-- RLS for templates (public read)
CREATE POLICY "Anyone can view templates" ON public.playbook_templates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage templates" ON public.playbook_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS for scripts
CREATE POLICY "Authenticated can view scripts" ON public.playbook_scripts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operators can manage scripts" ON public.playbook_scripts
  FOR ALL USING (
    auth.uid() IS NOT NULL AND 
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
  );

-- RLS for reviews
CREATE POLICY "Authenticated can view reviews" ON public.playbook_reviews
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Reviewers can manage reviews" ON public.playbook_reviews
  FOR ALL USING (
    auth.uid() IS NOT NULL AND 
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
  );

-- RLS for executions (audit trail - read only for most)
CREATE POLICY "Authenticated can view executions" ON public.playbook_executions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert executions" ON public.playbook_executions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS for test runs
CREATE POLICY "Authenticated can view test runs" ON public.playbook_test_runs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operators can manage test runs" ON public.playbook_test_runs
  FOR ALL USING (
    auth.uid() IS NOT NULL AND 
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
  );

-- Triggers pour updated_at
CREATE TRIGGER update_playbooks_updated_at
  BEFORE UPDATE ON public.playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_playbook_templates_updated_at
  BEFORE UPDATE ON public.playbook_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_playbook_scripts_updated_at
  BEFORE UPDATE ON public.playbook_scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index pour performances
CREATE INDEX idx_playbooks_status ON public.playbooks(status);
CREATE INDEX idx_playbooks_category ON public.playbooks(category);
CREATE INDEX idx_playbook_versions_playbook ON public.playbook_versions(playbook_id);
CREATE INDEX idx_playbook_executions_playbook ON public.playbook_executions(playbook_id);
CREATE INDEX idx_playbook_executions_order ON public.playbook_executions(order_id);
CREATE INDEX idx_playbook_scripts_infra ON public.playbook_scripts(infrastructure_id);