import { useAppMode } from '@/contexts/AppModeContext';
import { cn } from '@/lib/utils';
import { Zap, Gauge } from 'lucide-react';

interface ModeToggleProps {
  collapsed?: boolean;
}

export function ModeToggle({ collapsed }: ModeToggleProps) {
  const { mode, setMode } = useAppMode();

  if (collapsed) {
    return (
      <button
        onClick={() => setMode(mode === 'simple' ? 'expert' : 'simple')}
        className={cn(
          "w-full p-2 rounded-lg transition-all",
          mode === 'expert' 
            ? "bg-primary/20 text-primary" 
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
        title={mode === 'simple' ? 'Mode Simple' : 'Mode Expert'}
      >
        {mode === 'expert' ? <Zap className="w-5 h-5 mx-auto" /> : <Gauge className="w-5 h-5 mx-auto" />}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
      <button
        onClick={() => setMode('simple')}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
          mode === 'simple'
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Gauge className="w-4 h-4" />
        Simple
      </button>
      <button
        onClick={() => setMode('expert')}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
          mode === 'expert'
            ? "bg-primary/20 text-primary shadow-sm glow-border"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Zap className="w-4 h-4" />
        Expert
      </button>
    </div>
  );
}
