import { useState } from 'react';
import { Server, Plus, RefreshCw, Info, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ServerCard } from '@/components/servers/ServerCard';
import { ServerForm } from '@/components/servers/ServerForm';
import { ServerApiDiagnostic } from '@/components/servers/ServerApiDiagnostic';
import {
  useEnrichedServers,
  useApiCreateServer,
  useApiDeleteServer,
  useApiUpdateServerRunner,
  type ProxyServer,
} from '@/hooks/useApiServers';

const Servers = () => {
  // Single hook that fetches servers + runners and enriches server data
  const { 
    data: enrichedServers, 
    runners, 
    runnersById,
    isLoading, 
    error, 
    refetch 
  } = useEnrichedServers();
  
  const createServer = useApiCreateServer();
  const deleteServer = useApiDeleteServer();
  const updateServerRunner = useApiUpdateServerRunner();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingServer, setDeletingServer] = useState<ProxyServer | null>(null);

  const handleCreate = () => {
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: { name: string; baseUrl?: string; runnerId?: string | null }) => {
    await createServer.mutateAsync(data);
    setIsFormOpen(false);
  };

  const handleDelete = async () => {
    if (deletingServer) {
      await deleteServer.mutateAsync(deletingServer.id);
      setDeletingServer(null);
    }
  };

  const handleRunnerChange = async (serverId: string, runnerId: string | null) => {
    await updateServerRunner.mutateAsync({ serverId, runnerId });
  };

  // Get runner object for a server (from our pre-built map)
  const getRunnerForServer = (server: ProxyServer) => {
    if (!server.runnerId) return null;
    return runnersById.get(server.runnerId) || null;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Serveurs"
          description="Gestion des serveurs et associations runners"
          icon={Server}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Serveurs"
        description="Gestion des serveurs et associations runners (source: API Orders)"
        icon={Server}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Rafraîchir</span>
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Créer serveur</span>
            </Button>
          </div>
        }
      />

      <Alert className="glass-panel border-primary/20">
        <Info className="w-4 h-4" />
        <AlertDescription>
          <strong>Module Serveurs (API-first) :</strong> Les serveurs et associations sont gérés via l'API Orders. 
          L'association officielle est <code className="bg-muted px-1 rounded">servers.runnerId</code>.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Erreur de chargement : {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* API Diagnostic Panel */}
      <ServerApiDiagnostic />

      {/* Servers Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Serveurs via API
        </h2>
        {enrichedServers && enrichedServers.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {enrichedServers.length} serveur{enrichedServers.length > 1 ? 's' : ''} • {runners.length} runners
          </span>
        )}
      </div>

      {enrichedServers && enrichedServers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enrichedServers.map(server => (
            <ServerCard
              key={server.id}
              server={server}
              runner={getRunnerForServer(server)}
              runners={runners}
              onRunnerChange={(runnerId) => handleRunnerChange(server.id, runnerId)}
              onDelete={() => setDeletingServer(server)}
              isUpdating={updateServerRunner.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-xl p-8">
          <div className="text-center py-12 text-muted-foreground">
            <Server className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">Aucun serveur dans l'API</h3>
            <p className="text-sm max-w-md mx-auto mb-6">
              Créez des serveurs via l'API Orders pour les associer aux runners.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Créer un serveur
            </Button>
          </div>
        </div>
      )}

      {/* Create Form Dialog */}
      <ServerForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        runners={runners}
        onSubmit={handleSubmit}
        isLoading={createServer.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingServer} onOpenChange={(open) => !open && setDeletingServer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le serveur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le serveur "{deletingServer?.name}" sera supprimé de l'API.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Servers;
