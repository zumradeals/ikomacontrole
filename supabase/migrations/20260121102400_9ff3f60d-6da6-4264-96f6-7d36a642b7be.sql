-- Remove FK constraint on orders.runner_id to allow external API runner IDs
-- The runners are managed by the external Orders API, not local Supabase
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_runner_id_fkey;

-- Add a comment explaining why there's no FK
COMMENT ON COLUMN public.orders.runner_id IS 'References runner ID from external Orders API (api.ikomadigit.com), not local runners table';