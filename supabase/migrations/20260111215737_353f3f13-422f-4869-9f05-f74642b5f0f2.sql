-- Ensure settings are only accessible to signed-in users
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Read settings (signed-in users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'settings' AND policyname = 'settings_select_authenticated'
  ) THEN
    CREATE POLICY settings_select_authenticated
    ON public.settings
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

-- Update settings (signed-in users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'settings' AND policyname = 'settings_update_authenticated'
  ) THEN
    CREATE POLICY settings_update_authenticated
    ON public.settings
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Insert settings (needed for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'settings' AND policyname = 'settings_insert_authenticated'
  ) THEN
    CREATE POLICY settings_insert_authenticated
    ON public.settings
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;
END $$;