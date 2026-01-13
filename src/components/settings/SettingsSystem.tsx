import { useRef } from 'react';
import { Save, Hexagon, Palette, Sparkles, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAppMode } from '@/contexts/AppModeContext';
import { useSettingInput } from '@/hooks/useSettings';
import { useSystemLogo } from '@/hooks/useSystemLogo';
import { useCurrentUserRole } from '@/hooks/useUserRoles';
import { toast } from 'sonner';

export function SettingsSystem() {
  const { mode, setMode, isExpert } = useAppMode();
  const { logoUrl, isUploading, uploadLogo, removeLogo } = useSystemLogo();
  const { isAdmin } = useCurrentUserRole();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    value: systemName, 
    onChange: setSystemName, 
    onSave: saveSystemName,
    isUpdating: isUpdatingName,
    isDirty: isNameDirty 
  } = useSettingInput('system_name');

  const handleSaveName = async () => {
    try {
      await saveSystemName();
      toast.success('Nom du système sauvegardé');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadLogo(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* System Identity */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Hexagon className="w-4 h-4 text-primary" />
            Identité du Système
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Personnalisez l'apparence et le nom de votre Control Plane
          </p>
        </div>

        <div className="grid gap-6">
          {/* System Name */}
          <div className="space-y-2">
            <Label htmlFor="system_name">Nom du système</Label>
            <div className="flex gap-2">
              <Input
                id="system_name"
                placeholder="IKOMA Control Plane"
                value={systemName || 'IKOMA Control Plane'}
                onChange={(e) => setSystemName(e.target.value)}
              />
              <Button 
                onClick={handleSaveName} 
                disabled={!isNameDirty || isUpdatingName}
                variant={isNameDirty ? "default" : "outline"}
                size="sm"
              >
                <Save className="w-4 h-4 mr-2" />
                {isUpdatingName ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Affiché dans l'en-tête et les notifications
            </p>
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Logo du système</Label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt="Logo système" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Hexagon className="w-8 h-8 text-primary" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg,image/webp"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || !isAdmin}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? 'Téléchargement...' : 'Changer le logo'}
                  </Button>
                  {logoUrl && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={removeLogo}
                      disabled={!isAdmin}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isAdmin 
                    ? 'PNG, SVG, JPEG ou WebP • max 2 Mo' 
                    : 'Réservé aux administrateurs'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            Apparence
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Personnalisez les couleurs et le thème
          </p>
        </div>

        <div className="space-y-4">
          {/* Accent Color - Placeholder */}
          <div className="space-y-2">
            <Label>Couleur d'accent</Label>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'].map((color) => (
                  <button
                    key={color}
                    className="w-8 h-8 rounded-full border-2 border-transparent hover:border-white/50 transition-all"
                    style={{ backgroundColor: color }}
                    disabled
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">Bientôt disponible</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="glass-panel rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Mode d'Interface
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Contrôlez la complexité de l'interface utilisateur
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="space-y-1">
              <Label htmlFor="expert-mode" className="font-medium">Mode Expert</Label>
              <p className="text-xs text-muted-foreground">
                Affiche les options avancées : Routage, Observabilité détaillée, Déploiements personnalisés
              </p>
            </div>
            <Switch
              id="expert-mode"
              checked={isExpert}
              onCheckedChange={(checked) => {
                setMode(checked ? 'expert' : 'simple');
                toast.success(checked ? 'Mode Expert activé' : 'Mode Simple activé');
              }}
            />
          </div>

          <div className="text-xs text-muted-foreground p-3 bg-primary/5 rounded-lg border border-primary/10">
            <strong>Mode Simple :</strong> Dashboard, Serveurs, Agents, Services<br />
            <strong>Mode Expert :</strong> + Déploiements, Routage, Observabilité avancée
          </div>
        </div>
      </div>
    </div>
  );
}
