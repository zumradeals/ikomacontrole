-- Insert default API URL settings if they don't exist
INSERT INTO public.settings (key, value, description)
VALUES 
  ('orders_api_base_url', 'https://automate.ikomadigit.com', 'URL de base de l''API Orders (endpoints: /health, /ready, /install-runner.sh)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, description)
VALUES 
  ('orders_api_v1_url', 'https://automate.ikomadigit.com/v1', 'URL V1 de l''API Orders (endpoints métier: /v1/*)')
ON CONFLICT (key) DO NOTHING;