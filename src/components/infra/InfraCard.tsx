import { HardDrive, Server, Cloud, Cpu, MemoryStick, HardDriveIcon, Pencil, Trash2, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Infrastructure } from '@/hooks/useInfrastructures';

interface InfraCardProps {
  infra: Infrastructure;
  runnerName?: string;
  onEdit: () => void;
  onDelete: () => void;
  onViewDetails: () => void;
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

export function InfraCard({ infra, runnerName, onEdit, onDelete, onViewDetails }: InfraCardProps) {
  const TypeIcon = typeIcons[infra.type] || HardDrive;

  return (
    <Card className="glass-panel hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TypeIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{infra.name}</CardTitle>
              <Badge variant="outline" className="mt-1">
                {typeLabels[infra.type]}
              </Badge>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onViewDetails}>
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* OS & Architecture */}
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {infra.os && <span>{infra.os}</span>}
          {infra.distribution && <span>• {infra.distribution}</span>}
          {infra.architecture && <span>• {infra.architecture}</span>}
        </div>

        {/* Specs */}
        {(infra.cpu_cores || infra.ram_gb || infra.disk_gb) && (
          <div className="flex flex-wrap gap-3 text-sm">
            {infra.cpu_cores && (
              <div className="flex items-center gap-1">
                <Cpu className="w-4 h-4 text-muted-foreground" />
                <span>{infra.cpu_cores} CPU</span>
              </div>
            )}
            {infra.ram_gb && (
              <div className="flex items-center gap-1">
                <MemoryStick className="w-4 h-4 text-muted-foreground" />
                <span>{infra.ram_gb} GB RAM</span>
              </div>
            )}
            {infra.disk_gb && (
              <div className="flex items-center gap-1">
                <HardDriveIcon className="w-4 h-4 text-muted-foreground" />
                <span>{infra.disk_gb} GB</span>
              </div>
            )}
          </div>
        )}

        {/* Runner association */}
        <div className="pt-2 border-t border-border/50">
          {runnerName ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm">Runner: <strong>{runnerName}</strong></span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Aucun runner associé</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
