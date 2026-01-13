import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from './useSettings';
import { toast } from 'sonner';

export function useSystemLogo() {
  const [isUploading, setIsUploading] = useState(false);
  const { getSetting, updateSetting } = useSettings();
  const queryClient = useQueryClient();
  
  const logoUrl = getSetting('system_logo');

  const uploadLogo = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez PNG, SVG, JPEG ou WebP.');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux. Maximum 2 Mo.');
      return;
    }

    setIsUploading(true);
    
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `branding/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('system-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('system-assets')
        .getPublicUrl(filePath);

      // Save URL to settings
      await updateSetting('system_logo', publicUrl);
      
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Logo mis à jour avec succès');
      
      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error(error.message || 'Erreur lors du téléchargement');
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const removeLogo = async () => {
    try {
      await updateSetting('system_logo', '');
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Logo supprimé');
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
      throw error;
    }
  };

  return {
    logoUrl,
    isUploading,
    uploadLogo,
    removeLogo,
  };
}
