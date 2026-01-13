import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'admin' | 'operator' | 'viewer';

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  created_by: string | null;
}

interface UserInvitation {
  id: string;
  email: string;
  role: AppRole;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
}

interface UserWithRole {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
}

export function useUserRoles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all user roles
  const { data: userRoles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as UserRole[];
    },
  });

  // Fetch invitations
  const { data: invitations, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserInvitation[];
    },
  });

  // Check if current user is admin
  const isAdmin = userRoles?.some(r => r.user_id === user?.id && r.role === 'admin') ?? false;

  // Get current user's role
  const currentUserRole = userRoles?.find(r => r.user_id === user?.id)?.role ?? 'viewer';

  // Create invitation mutation
  const createInvitation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      const { data, error } = await supabase
        .from('user_invitations')
        .insert({
          email,
          role,
          invited_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
    },
  });

  // Cancel invitation mutation
  const cancelInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('user_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
    },
  });

  // Update user role mutation
  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // First delete existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      // Insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    },
  });

  // Remove user (delete their role)
  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    },
  });

  return {
    userRoles,
    invitations,
    isLoading: isLoadingRoles || isLoadingInvitations,
    isAdmin,
    currentUserRole,
    createInvitation,
    cancelInvitation,
    updateUserRole,
    removeUser,
  };
}

export function useCurrentUserRole() {
  const { user } = useAuth();
  
  const { data: role, isLoading } = useQuery({
    queryKey: ['current-user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return 'viewer' as AppRole; // No role found
        throw error;
      }
      return data.role as AppRole;
    },
    enabled: !!user?.id,
  });

  return { role: role ?? 'viewer', isLoading, isAdmin: role === 'admin' };
}
