-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    UNIQUE (user_id, role)
);

-- Create invitations table
CREATE TABLE public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role app_role NOT NULL DEFAULT 'viewer',
    invited_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user can manage users (admin only)
CREATE OR REPLACE FUNCTION public.can_manage_users(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_users(auth.uid()));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.can_manage_users(auth.uid()));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.can_manage_users(auth.uid()));

-- RLS policies for invitations
CREATE POLICY "Authenticated can view invitations"
ON public.user_invitations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can create invitations"
ON public.user_invitations FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_users(auth.uid()));

CREATE POLICY "Admins can update invitations"
ON public.user_invitations FOR UPDATE
TO authenticated
USING (public.can_manage_users(auth.uid()));

CREATE POLICY "Admins can delete invitations"
ON public.user_invitations FOR DELETE
TO authenticated
USING (public.can_manage_users(auth.uid()));

-- Create storage bucket for system assets
INSERT INTO storage.buckets (id, name, public) VALUES ('system-assets', 'system-assets', true);

-- Storage policies for system assets
CREATE POLICY "Anyone can view system assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'system-assets');

CREATE POLICY "Admins can upload system assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'system-assets' AND public.can_manage_users(auth.uid()));

CREATE POLICY "Admins can update system assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'system-assets' AND public.can_manage_users(auth.uid()));

CREATE POLICY "Admins can delete system assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'system-assets' AND public.can_manage_users(auth.uid()));

-- Auto-assign admin role to first user (current authenticated users)
-- This is a one-time setup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If no admin exists, make this user admin, otherwise viewer
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    -- Check if user was invited
    DECLARE
      invitation_record RECORD;
    BEGIN
      SELECT * INTO invitation_record 
      FROM public.user_invitations 
      WHERE email = NEW.email 
        AND status = 'pending' 
        AND expires_at > now()
      LIMIT 1;
      
      IF FOUND THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, invitation_record.role);
        UPDATE public.user_invitations SET status = 'accepted', accepted_at = now() WHERE id = invitation_record.id;
      ELSE
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-assign roles on user creation
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_role();

-- Insert system_logo setting if not exists
INSERT INTO public.settings (key, value, description)
VALUES ('system_logo', '', 'URL du logo personnalisé du système')
ON CONFLICT (key) DO NOTHING;