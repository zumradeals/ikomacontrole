-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- Create order category enum
CREATE TYPE public.order_category AS ENUM ('installation', 'update', 'security', 'maintenance', 'detection');

-- Create orders table for system commands
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runner_id uuid NOT NULL REFERENCES public.runners(id) ON DELETE CASCADE,
  infrastructure_id uuid REFERENCES public.infrastructures(id) ON DELETE SET NULL,
  
  -- Order details
  category order_category NOT NULL,
  name text NOT NULL,
  description text,
  command text NOT NULL,
  
  -- Status tracking
  status order_status NOT NULL DEFAULT 'pending',
  progress integer DEFAULT 0,
  result jsonb DEFAULT '{}'::jsonb,
  error_message text,
  
  -- Metadata
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view orders" 
ON public.orders FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create orders" 
ON public.orders FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update orders" 
ON public.orders FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete orders" 
ON public.orders FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create index on runner_id and status for polling
CREATE INDEX idx_orders_runner_status ON public.orders(runner_id, status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;