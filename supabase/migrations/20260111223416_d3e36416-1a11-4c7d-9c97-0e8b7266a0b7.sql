-- Create infrastructure type enum
CREATE TYPE public.infra_type AS ENUM ('vps', 'bare_metal', 'cloud');

-- Create infrastructures table
CREATE TABLE public.infrastructures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type infra_type NOT NULL DEFAULT 'vps',
  os TEXT,
  distribution TEXT,
  architecture TEXT,
  cpu_cores INTEGER,
  ram_gb NUMERIC,
  disk_gb NUMERIC,
  capabilities JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.infrastructures ENABLE ROW LEVEL SECURITY;

-- Create index on created_by
CREATE INDEX idx_infrastructures_created_by ON public.infrastructures(created_by);

-- Trigger for updated_at
CREATE TRIGGER update_infrastructures_updated_at
  BEFORE UPDATE ON public.infrastructures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for infrastructures
-- SELECT: all authenticated users can view
CREATE POLICY "Authenticated users can view infrastructures"
  ON public.infrastructures
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: authenticated users can create
CREATE POLICY "Authenticated users can create infrastructures"
  ON public.infrastructures
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: authenticated users can update
CREATE POLICY "Authenticated users can update infrastructures"
  ON public.infrastructures
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- DELETE: authenticated users can delete
CREATE POLICY "Authenticated users can delete infrastructures"
  ON public.infrastructures
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Add infrastructure_id FK to runners if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'runners_infrastructure_id_fkey'
  ) THEN
    ALTER TABLE public.runners
    ADD CONSTRAINT runners_infrastructure_id_fkey
    FOREIGN KEY (infrastructure_id) REFERENCES public.infrastructures(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Create index on runners.infrastructure_id
CREATE INDEX IF NOT EXISTS idx_runners_infrastructure_id ON public.runners(infrastructure_id);

-- Enable realtime for infrastructures
ALTER PUBLICATION supabase_realtime ADD TABLE public.infrastructures;