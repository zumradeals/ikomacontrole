import { Network, Plus, Globe, Server, FileCode, Activity } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppMode } from '@/contexts/AppModeContext';

const Gateway = () => {
  const { isExpert } = useAppMode();

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Gateway"
        description="Réseau, routes et audit du système"
        icon={Network}
        actions={
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Route
          </Button>
        }
      />

      <Tabs defaultValue="network" className="space-y-6">
        <TabsList className="glass-panel p-1 flex-wrap">
          <TabsTrigger value="network" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Réseau
          </TabsTrigger>
          {isExpert && (
            <>
              <TabsTrigger value="generator" className="flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                Générateur
              </TabsTrigger>
              <TabsTrigger value="runners" className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                Runners
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Ordres
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="network">
          <div className="glass-panel rounded-xl p-5">
            <h3 className="font-semibold mb-4">Routes Réseau</h3>
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune route configurée</p>
              <p className="text-sm mt-2">
                Publiez des routes pour exposer vos services
              </p>
            </div>
          </div>
        </TabsContent>

        {isExpert && (
          <>
            <TabsContent value="generator">
              <div className="glass-panel rounded-xl p-5">
                <h3 className="font-semibold mb-4">IKOMA Generator</h3>
                <p className="text-muted-foreground text-center py-8">
                  Analysez un repo GitHub pour générer les fichiers de déploiement
                </p>
              </div>
            </TabsContent>

            <TabsContent value="runners">
              <div className="glass-panel rounded-xl p-5">
                <h3 className="font-semibold mb-4">État des Runners</h3>
                <p className="text-muted-foreground text-center py-8">
                  Vue d'audit des runners du système
                </p>
              </div>
            </TabsContent>

            <TabsContent value="orders">
              <div className="glass-panel rounded-xl p-5">
                <h3 className="font-semibold mb-4">Historique des Ordres</h3>
                <p className="text-muted-foreground text-center py-8">
                  Consultez tous les ordres émis et leur statut
                </p>
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

export default Gateway;
