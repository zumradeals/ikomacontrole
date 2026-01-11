-- Table settings pour persister la configuration
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs authentifiés peuvent lire
CREATE POLICY "All authenticated can view settings" 
ON public.settings FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Seuls les utilisateurs authentifiés peuvent modifier (à affiner avec roles plus tard)
CREATE POLICY "Authenticated users can manage settings" 
ON public.settings FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Insert default runner_base_url
INSERT INTO public.settings (key, value, description) 
VALUES ('runner_base_url', '', 'URL de base API pour les runners');

-- Table runners pour les agents
CREATE TABLE public.runners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'paused', 'unknown')),
  capabilities JSONB DEFAULT '{}',
  host_info JSONB DEFAULT '{}',
  infrastructure_id UUID,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.runners ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs authentifiés peuvent lire
CREATE POLICY "All authenticated can view runners" 
ON public.runners FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Insertion/modification pour authentifiés
CREATE POLICY "Authenticated users can manage runners" 
ON public.runners FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Index for performance
CREATE INDEX idx_runners_status ON public.runners(status);
CREATE INDEX idx_runners_last_seen ON public.runners(last_seen_at);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_runners_updated_at
BEFORE UPDATE ON public.runners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for runners
ALTER PUBLICATION supabase_realtime ADD TABLE public.runners;