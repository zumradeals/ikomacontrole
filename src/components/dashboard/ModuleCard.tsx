import { LucideIcon, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ModuleCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  status?: 'active' | 'inactive' | 'warning';
  count?: number;
}

export function ModuleCard({ title, description, icon: Icon, path, status = 'inactive', count }: ModuleCardProps) {
  return (
    <Link
      to={path}
      className={cn(
        "glass-panel rounded-xl p-5 group transition-all duration-300 hover:scale-[1.02] block",
        status === 'active' && "glow-border",
        status === 'warning' && "glow-border-warning"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          status === 'active' ? "bg-primary/20" : "bg-muted"
        )}>
          <Icon className={cn(
            "w-5 h-5",
            status === 'active' ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
        {count !== undefined && (
          <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      
      <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
        {description}
      </p>
      
      <div className="flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Accéder</span>
        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}
