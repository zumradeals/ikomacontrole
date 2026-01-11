import { Plus, RefreshCw, Terminal, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppMode } from '@/contexts/AppModeContext';

export function QuickActions() {
  const { isExpert } = useAppMode();

  return (
    <div className="glass-panel rounded-xl p-5">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        Actions Rapides
      </h3>
      
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2">
          <Plus className="w-5 h-5" />
          <span className="text-xs">Nouveau Runner</span>
        </Button>
        
        <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          <span className="text-xs">Sync Status</span>
        </Button>
        
        {isExpert && (
          <>
            <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2">
              <Terminal className="w-5 h-5" />
              <span className="text-xs">Console SSH</span>
            </Button>
            
            <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2">
              <Zap className="w-5 h-5" />
              <span className="text-xs">Ordre Manuel</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
