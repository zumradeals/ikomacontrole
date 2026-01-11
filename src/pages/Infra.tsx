import { HardDrive, Plus, Filter } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

const Infra = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Infrastructure"
        description="Registre et configuration de vos serveurs"
        icon={HardDrive}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtrer
            </Button>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Déclarer Infra
            </Button>
          </div>
        }
      />

      {/* Empty State */}
      <div className="glass-panel rounded-xl p-5">
        <div className="text-center py-12 text-muted-foreground">
          <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune infrastructure déclarée</p>
          <p className="text-sm mt-2">
            Déclarez vos serveurs pour les associer aux runners
          </p>
          <Button className="mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Déclarer une Infrastructure
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Infra;
