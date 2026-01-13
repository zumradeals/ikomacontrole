import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Server, 
  HardDrive, 
  Terminal, 
  Rocket, 
  Network, 
  Eye, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Hexagon,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { ModeToggle } from './ModeToggle';
import { UserMenu } from './UserMenu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAppMode } from '@/contexts/AppModeContext';

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  expertOnly?: boolean;
}

// Navigation items with French labels and expert mode flags
const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/infra', label: 'Serveurs', icon: HardDrive },
  { path: '/runner', label: 'Agents', icon: Server },
  { path: '/platform', label: 'Playbooks', icon: Terminal },
  { path: '/deployer', label: 'Déploiements', icon: Rocket, expertOnly: true },
  { path: '/gateway', label: 'Routage', icon: Network, expertOnly: true },
  { path: '/observability', label: 'Observabilité', icon: Eye, expertOnly: true },
  { path: '/settings', label: 'Paramètres', icon: Settings },
];

// Mobile Header with burger menu
export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { isExpert } = useAppMode();

  // Close sheet on navigation
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const visibleItems = navItems.filter(item => !item.expertOnly || isExpert);

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
      <Link to="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center glow-border">
          <Hexagon className="w-5 h-5 text-primary" />
        </div>
        <span className="text-lg font-semibold text-gradient">IKOMA</span>
      </Link>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
          <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border">
            <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center glow-border">
                <Hexagon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-semibold text-gradient">IKOMA</span>
            </Link>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto terminal-scroll">
            {visibleItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-primary/10 text-primary glow-border" 
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-sidebar-border">
            <ModeToggle collapsed={false} />
          </div>

          <div className="p-3 border-t border-sidebar-border">
            <UserMenu collapsed={false} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

// Desktop Sidebar
export function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { isExpert } = useAppMode();

  const visibleItems = navItems.filter(item => !item.expertOnly || isExpert);

  return (
    <>
      {/* Mobile Header */}
      <MobileHeader />

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden lg:flex fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex-col transition-all duration-300 z-50",
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
          {visibleItems.map((item) => {
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

        {/* User Menu */}
        <div className="p-3 border-t border-sidebar-border">
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}
