import { Activity, Filter, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useAppMode } from '@/contexts/AppModeContext';

const ActivityPage = () => {
  const { isExpert } = useAppMode();

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Activité"
        description="Journal d'activité du système"
        icon={Activity}
        actions={
          isExpert && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filtrer
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exporter
              </Button>
            </div>
          )
        }
      />

      <div className="glass-panel rounded-xl p-5">
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune activité récente</p>
          <p className="text-sm mt-2">
            Les événements système apparaîtront ici
          </p>
        </div>
      </div>
    </div>
  );
};

export default ActivityPage;
