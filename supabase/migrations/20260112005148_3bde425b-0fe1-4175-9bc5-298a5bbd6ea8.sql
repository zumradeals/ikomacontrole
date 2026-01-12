-- Add exit_code column to orders for reliable status determination
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS exit_code integer;

-- Add report_incomplete flag to track partial reports
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS report_incomplete boolean DEFAULT false;

-- Add stdout_tail and stderr_tail for debugging failed commands
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stdout_tail text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stderr_tail text;

-- Add meta field for playbook info, version, etc.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;

-- Create table to store raw body of failed report parsing attempts
CREATE TABLE IF NOT EXISTS public.runner_report_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runner_id uuid REFERENCES public.runners(id) ON DELETE SET NULL,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  raw_body text NOT NULL,
  error_type text NOT NULL,
  error_details text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on runner_report_errors
ALTER TABLE public.runner_report_errors ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can view report errors
CREATE POLICY "Authenticated users can view runner_report_errors"
  ON public.runner_report_errors
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Enable realtime for runner_report_errors
ALTER PUBLICATION supabase_realtime ADD TABLE public.runner_report_errors;