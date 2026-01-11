-- Create runner_logs table to store API events and errors
CREATE TABLE public.runner_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  runner_id UUID REFERENCES public.runners(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  level TEXT NOT NULL DEFAULT 'info', -- 'info', 'warn', 'error'
  event_type TEXT NOT NULL, -- 'report_received', 'report_error', 'poll', 'heartbeat', etc.
  message TEXT NOT NULL,
  raw_body TEXT, -- Store raw request body for debugging
  parsed_data JSONB, -- Parsed data if successful
  error_details TEXT, -- Error details if parsing failed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_runner_logs_runner_id ON public.runner_logs(runner_id);
CREATE INDEX idx_runner_logs_timestamp ON public.runner_logs(timestamp DESC);
CREATE INDEX idx_runner_logs_level ON public.runner_logs(level);

-- Enable RLS
ALTER TABLE public.runner_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view logs
CREATE POLICY "Users can view runner logs"
  ON public.runner_logs
  FOR SELECT
  USING (true);

-- Enable realtime for runner_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.runner_logs;