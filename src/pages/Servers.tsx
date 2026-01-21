import { useState } from 'react';
import { Server, Plus, RefreshCw, AlertCircle, Activity, Link2, Link2Off, MoreVertical, Eye, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ServerForm } from '@/components/servers/ServerForm';
import { ServerEditForm } from '@/components/servers/ServerEditForm';
import { ServerDetails } from '@/components/servers/ServerDetails';
import { ServerApiDiagnostic } from '@/components/servers/ServerApiDiagnostic';
import { cn } from '@/lib/utils';
import {
  useEnrichedServers,
  useApiCreateServer,
  useApiDeleteServer,
  useApiUpdateServerRunner,
  useApiUpdateServer,
  type ProxyServer,
} from '@/hooks/useApiServers';

const Servers = () => {
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
  const updateServer = useApiUpdateServer();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ProxyServer | null>(null);
  const [viewingServer, setViewingServer] = useState<ProxyServer | null>(null);
  const [deletingServer, setDeletingServer] = useState<ProxyServer | null>(null);

  const handleCreate = () => setIsFormOpen(true);

  const handleSubmit = async (data: { name: string; baseUrl?: string; runnerId?: string | null }) => {
    await createServer.mutateAsync(data);
    setIsFormOpen(false);
  };

  const handleEdit = (server: ProxyServer) => {
    setEditingServer(server);
  };

  const handleEditSubmit = async (data: { name: string; host?: string }) => {
    if (editingServer) {
      await updateServer.mutateAsync({
        serverId: editingServer.id,
        name: data.name,
        host: data.host,
      });
      setEditingServer(null);
      // If we're viewing this server, update the view
      if (viewingServer?.id === editingServer.id) {
        setViewingServer(null);
      }
    }
  };

  const handleDelete = async () => {
    if (deletingServer) {
      await deleteServer.mutateAsync(deletingServer.id);
      setDeletingServer(null);
      setViewingServer(null);
    }
  };

  const handleRunnerChange = async (serverId: string, runnerId: string | null) => {
    await updateServerRunner.mutateAsync({ serverId, runnerId });
  };

  const getRunnerForServer = (server: ProxyServer) => {
    if (!server.runnerId) return null;
    return runnersById.get(server.runnerId) || null;
  };

  // Stats
  const totalServers = enrichedServers?.length || 0;
  const associatedCount = enrichedServers?.filter(s => s.runnerId).length || 0;
  const onlineRunners = runners.filter(r => r.status === 'ONLINE').length;

  // If viewing details
  if (viewingServer) {
    const freshServer = enrichedServers?.find(s => s.id === viewingServer.id) || viewingServer;
    return (
      <>
        <ServerDetails
          server={freshServer}
          runner={getRunnerForServer(freshServer)}
          runners={runners}
          onBack={() => setViewingServer(null)}
          onEdit={() => handleEdit(freshServer)}
          onDelete={() => setDeletingServer(freshServer)}
          onRunnerChange={(runnerId) => handleRunnerChange(freshServer.id, runnerId)}
          isUpdating={updateServerRunner.isPending}
        />

        {/* Edit Form Dialog */}
        <ServerEditForm
          open={!!editingServer}
          onOpenChange={(open) => !open && setEditingServer(null)}
          server={editingServer}
          onSubmit={handleEditSubmit}
          isLoading={updateServer.isPending}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingServer} onOpenChange={(open) => !open && setDeletingServer(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer le serveur ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Le serveur "{deletingServer?.name}" sera supprimé définitivement.
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
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Serveurs"
          description="Gérez vos serveurs et leurs agents associés"
          icon={Server}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Serveurs"
        description="Gérez vos serveurs et leurs agents associés"
        icon={Server}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Rafraîchir</span>
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Nouveau serveur</span>
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-panel border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Serveurs</p>
                <p className="text-2xl font-bold">{totalServers}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Server className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Associés</p>
                <p className="text-2xl font-bold">{associatedCount}<span className="text-sm text-muted-foreground font-normal">/{totalServers}</span></p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agents en ligne</p>
                <p className="text-2xl font-bold text-emerald-500">{onlineRunners}<span className="text-sm text-muted-foreground font-normal">/{runners.length}</span></p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Erreur de chargement : {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Diagnostic Panel (collapsible) */}
      <ServerApiDiagnostic />

      {/* Servers List */}
      {enrichedServers && enrichedServers.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {totalServers} serveur{totalServers > 1 ? 's' : ''} enregistré{totalServers > 1 ? 's' : ''}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {enrichedServers.map(server => {
              const runner = getRunnerForServer(server);
              const hasRunner = !!server.runnerId;
              const runnerName = runner?.name || server.runnerName;
              const runnerStatus = runner?.status || server.runnerStatus;

              return (
                <Card 
                  key={server.id} 
                  className="glass-panel hover:border-primary/30 transition-all group cursor-pointer"
                  onClick={() => setViewingServer(server)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                          <Server className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{server.name}</h3>
                          {server.host && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {server.host}
                            </p>
                          )}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setViewingServer(server); }}>
                            <Eye className="w-4 h-4 mr-2" />
                            Voir détails
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(server); }}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeletingServer(server); }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Status Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        variant={hasRunner ? 'default' : 'secondary'}
                        className={cn(
                          'text-xs',
                          hasRunner && 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                        )}
                      >
                        {hasRunner ? (
                          <><Link2 className="w-3 h-3 mr-1" /> Associé</>
                        ) : (
                          <><Link2Off className="w-3 h-3 mr-1" /> Non associé</>
                        )}
                      </Badge>

                      {hasRunner && runnerStatus && (
                        <Badge 
                          variant="outline"
                          className={cn(
                            'text-xs',
                            runnerStatus === 'ONLINE' && 'border-emerald-500/30 text-emerald-500',
                            runnerStatus === 'OFFLINE' && 'border-muted-foreground/30 text-muted-foreground'
                          )}
                        >
                          <span className={cn(
                            'w-1.5 h-1.5 rounded-full mr-1.5',
                            runnerStatus === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'
                          )} />
                          {runnerName || 'Agent'}
                        </Badge>
                      )}
                    </div>

                    {/* Quick info */}
                    <p className="text-xs text-muted-foreground">
                      Cliquez pour voir les détails et l'historique des commandes
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="glass-panel">
          <CardContent className="py-16">
            <div className="text-center text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Server className="w-8 h-8 text-primary/60" />
              </div>
              <h3 className="text-lg font-medium mb-2">Aucun serveur</h3>
              <p className="text-sm max-w-md mx-auto mb-6">
                Créez votre premier serveur pour commencer à gérer vos infrastructures et associer des agents.
              </p>
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Créer un serveur
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Form Dialog */}
      <ServerForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        runners={runners}
        onSubmit={handleSubmit}
        isLoading={createServer.isPending}
      />

      {/* Edit Form Dialog */}
      <ServerEditForm
        open={!!editingServer}
        onOpenChange={(open) => !open && setEditingServer(null)}
        server={editingServer}
        onSubmit={handleEditSubmit}
        isLoading={updateServer.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingServer} onOpenChange={(open) => !open && setDeletingServer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le serveur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le serveur "{deletingServer?.name}" sera supprimé définitivement.
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
