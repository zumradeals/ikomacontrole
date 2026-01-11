import { HardDrive, Server, Cloud, Cpu, MemoryStick, HardDrive as HardDriveIcon, MapPin, Users } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Infrastructure } from '@/hooks/useInfrastructures';

interface InfraCardProps {
  infra: Infrastructure;
  runnerCount: number;
  onClick: () => void;
}

const typeIcons = {
  vps: Server,
  bare_metal: HardDrive,
  cloud: Cloud,
};

const typeLabels = {
  vps: 'VPS',
  bare_metal: 'Bare Metal',
  cloud: 'Cloud',
};

const typeColors = {
  vps: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  bare_metal: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  cloud: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

// Get capability icons to display
function getCapabilityIcons(caps: Record<string, unknown>) {
  const icons: { key: string; available: boolean }[] = [];
  
  const checkCap = (key: string) => {
    if (caps[key] === true) icons.push({ key, available: true });
    else if (caps[key] === false) icons.push({ key, available: false });
  };

  checkCap('docker');
  checkCap('git');
  checkCap('root_access');
  checkCap('https_possible');
  checkCap('internet_access');

  return icons.slice(0, 6); // Max 6 icons
}

const capabilityLabels: Record<string, string> = {
  docker: 'Docker',
  git: 'Git',
  root_access: 'Root',
  https_possible: 'HTTPS',
  internet_access: 'Internet',
  docker_compose: 'Compose',
  exposable_ports: 'Ports',
};

export function InfraCard({ infra, runnerCount, onClick }: InfraCardProps) {
  const TypeIcon = typeIcons[infra.type] || HardDrive;
  const caps = (infra.capabilities as Record<string, unknown>) || {};
  const capIcons = getCapabilityIcons(caps);

  return (
    <Card 
      className="glass-panel hover:border-primary/30 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/15 transition-colors">
            <TypeIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
              {infra.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={typeColors[infra.type]}>
                {typeLabels[infra.type]}
              </Badge>
              {infra.os && (
                <span className="text-xs text-muted-foreground">{infra.os}</span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Specs Row */}
        <div className="flex flex-wrap gap-4 text-sm">
          {infra.cpu_cores && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Cpu className="w-3.5 h-3.5" />
              <span>{infra.cpu_cores} CPU</span>
            </div>
          )}
          {infra.ram_gb && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MemoryStick className="w-3.5 h-3.5" />
              <span>{infra.ram_gb} Go</span>
            </div>
          )}
          {infra.disk_gb && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <HardDriveIcon className="w-3.5 h-3.5" />
              <span>{infra.disk_gb} Go</span>
            </div>
          )}
          {caps.location && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span>{caps.location as string}</span>
            </div>
          )}
        </div>

        {/* Capabilities Preview */}
        {capIcons.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {capIcons.map(({ key, available }) => (
              <Badge 
                key={key}
                variant="outline"
                className={available 
                  ? 'bg-green-500/10 text-green-400 border-green-500/30 text-xs' 
                  : 'bg-red-500/10 text-red-400 border-red-500/30 text-xs'
                }
              >
                {available ? '✓' : '✗'} {capabilityLabels[key]}
              </Badge>
            ))}
          </div>
        )}

        {/* Runner Association */}
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            {runnerCount > 0 ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {runnerCount} runner{runnerCount > 1 ? 's' : ''} associé{runnerCount > 1 ? 's' : ''}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Aucun runner associé</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}