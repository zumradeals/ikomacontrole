import { useState } from 'react';
import { HardDrive, Plus, Filter, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
    }
  };

  const getRunnerForInfra = (infraId: string) => {
    const runner = runners?.find(r => r.infrastructure_id === infraId);
    return runner?.name;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Infrastructure"
          description="Registre et configuration de vos serveurs"
          icon={HardDrive}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Infrastructure"
        description="Registre et configuration de vos serveurs"
        icon={HardDrive}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Rafraîchir
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Déclarer Infra
            </Button>
          </div>
        }
      />

      {infrastructures && infrastructures.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {infrastructures.map(infra => (
            <InfraCard
              key={infra.id}
              infra={infra}
              runnerName={getRunnerForInfra(infra.id)}
              onEdit={() => handleEdit(infra)}
              onDelete={() => setDeletingInfra(infra)}
              onViewDetails={() => setViewingInfra(infra)}
            />
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-xl p-5">
          <div className="text-center py-12 text-muted-foreground">
            <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune infrastructure déclarée</p>
            <p className="text-sm mt-2">
              Déclarez vos serveurs pour les associer aux runners
            </p>
            <Button className="mt-4" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Déclarer une Infrastructure
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

      {/* Details Dialog */}
      <InfraDetails
        open={!!viewingInfra}
        onOpenChange={(open) => !open && setViewingInfra(null)}
        infrastructure={viewingInfra}
        runners={runners || []}
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
                  ⚠️ Le runner associé sera automatiquement dissocié.
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
