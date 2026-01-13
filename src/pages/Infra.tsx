import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HardDrive, Plus, RefreshCw, Info, Server } from 'lucide-react';
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
import { InfraCard } from '@/components/infra/InfraCard';
import { InfraForm } from '@/components/infra/InfraForm';
import { InfraDetails } from '@/components/infra/InfraDetails';
import {
  useInfrastructures,
  useCreateInfrastructure,
  useUpdateInfrastructure,
  useDeleteInfrastructure,
  Infrastructure,
  InfrastructureInput,
} from '@/hooks/useInfrastructures';
import { useRunners } from '@/hooks/useRunners';

const Infra = () => {
  const { data: infrastructures, isLoading, refetch } = useInfrastructures();
  const { data: runners } = useRunners();
  const createInfra = useCreateInfrastructure();
  const updateInfra = useUpdateInfrastructure();
  const deleteInfra = useDeleteInfrastructure();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInfra, setEditingInfra] = useState<Infrastructure | null>(null);
  const [viewingInfra, setViewingInfra] = useState<Infrastructure | null>(null);
  const [deletingInfra, setDeletingInfra] = useState<Infrastructure | null>(null);

  const handleCreate = () => {
    setEditingInfra(null);
    setIsFormOpen(true);
  };

  const handleEdit = (infra: Infrastructure) => {
    setEditingInfra(infra);
    setIsFormOpen(true);
    setViewingInfra(null);
  };

  const handleSubmit = async (data: InfrastructureInput) => {
    if (editingInfra) {
      await updateInfra.mutateAsync({ ...data, id: editingInfra.id });
    } else {
      await createInfra.mutateAsync(data);
    }
  };

  const handleDelete = () => {
    if (deletingInfra) {
      deleteInfra.mutate(deletingInfra.id);
      setDeletingInfra(null);
      setViewingInfra(null);
    }
  };

  const getRunnerCountForInfra = (infraId: string) => {
    return runners?.filter(r => r.infrastructure_id === infraId).length || 0;
  };

  // If viewing details, show the details page
  if (viewingInfra) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Serveurs"
          description="Registre et configuration de vos serveurs"
          icon={HardDrive}
        />

        <Alert className="glass-panel border-primary/20">
          <Info className="w-4 h-4" />
          <AlertDescription>
            <strong>Module Serveurs :</strong> Déclarez vos serveurs et leurs capacités. IKOMA ne crée rien — il observe et valide.
          </AlertDescription>
        </Alert>

        <InfraDetails
          infrastructure={viewingInfra}
          runners={runners || []}
          onBack={() => setViewingInfra(null)}
          onEdit={() => handleEdit(viewingInfra)}
          onDelete={() => setDeletingInfra(viewingInfra)}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingInfra} onOpenChange={(open) => !open && setDeletingInfra(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer l'infrastructure ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. L'infrastructure "{deletingInfra?.name}" sera supprimée.
                {runners?.some(r => r.infrastructure_id === deletingInfra?.id) && (
                  <span className="block mt-2 text-amber-500">
                    ⚠️ Les runners associés seront automatiquement dissociés.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Form Dialog */}
        <InfraForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          infrastructure={editingInfra}
          onSubmit={handleSubmit}
          isLoading={createInfra.isPending || updateInfra.isPending}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Serveurs"
          description="Registre et configuration de vos serveurs"
          icon={HardDrive}
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
        description="Registre et configuration de vos serveurs"
        icon={HardDrive}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Rafraîchir</span>
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Ajouter</span>
            </Button>
          </div>
        }
      />

      <Alert className="glass-panel border-primary/20">
        <Info className="w-4 h-4" />
        <AlertDescription>
          <strong>Module Serveurs :</strong> Déclarez vos serveurs et leurs capacités. IKOMA ne crée rien — il observe et valide.
        </AlertDescription>
      </Alert>

      {/* Infrastructures Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Serveurs déclarés
        </h2>
        {infrastructures && infrastructures.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {infrastructures.length} serveur{infrastructures.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {infrastructures && infrastructures.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {infrastructures.map(infra => (
            <InfraCard
              key={infra.id}
              infra={infra}
              runnerCount={getRunnerCountForInfra(infra.id)}
              onClick={() => setViewingInfra(infra)}
            />
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-xl p-8">
          <div className="text-center py-12 text-muted-foreground">
            <HardDrive className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">Aucune infrastructure déclarée</h3>
            <p className="text-sm max-w-md mx-auto mb-6">
              Déclarez vos serveurs (VPS, Bare Metal, Cloud) pour les associer aux runners et gérer leurs capacités.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Déclarer une infrastructure
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Form Dialog */}
      <InfraForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        infrastructure={editingInfra}
        onSubmit={handleSubmit}
        isLoading={createInfra.isPending || updateInfra.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingInfra} onOpenChange={(open) => !open && setDeletingInfra(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'infrastructure ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'infrastructure "{deletingInfra?.name}" sera supprimée.
              {runners?.some(r => r.infrastructure_id === deletingInfra?.id) && (
                <span className="block mt-2 text-amber-500">
                  ⚠️ Les runners associés seront automatiquement dissociés.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Infra;