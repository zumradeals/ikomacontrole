import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Server, 
  HardDrive, 
  Layers, 
  Rocket, 
  Network, 
  Radio, 
  Activity, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Hexagon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { ModeToggle } from './ModeToggle';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/runner', label: 'Runner', icon: Server },
  { path: '/infra', label: 'Infra', icon: HardDrive },
  { path: '/platform', label: 'Platform', icon: Layers },
  { path: '/deployer', label: 'Deployer', icon: Rocket },
  { path: '/gateway', label: 'Gateway', icon: Network },
  { path: '/live', label: 'Live', icon: Radio },
  { path: '/activity', label: 'Activity', icon: Activity },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 z-50",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center glow-border shrink-0">
            <Hexagon className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold text-gradient whitespace-nowrap">
              IKOMA
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto terminal-scroll">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-primary/10 text-primary glow-border" 
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 shrink-0",
                isActive && "text-primary"
              )} />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Mode Toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <ModeToggle collapsed={collapsed} />
      </div>
    </aside>
  );
}
