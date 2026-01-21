/**
 * CAPABILITIES DETAIL DIALOG
 * 
 * Modal dialog wrapper for the CapabilitiesDetailView component.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CapabilitiesDetailView } from './CapabilitiesDetailView';
import { Package } from 'lucide-react';

interface CapabilitiesDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runnerId: string;
  runnerName: string;
  capabilities: unknown;
}

export function CapabilitiesDetailDialog({
  open,
  onOpenChange,
  runnerId,
  runnerName,
  capabilities,
}: CapabilitiesDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Détail des capacités
          </DialogTitle>
        </DialogHeader>
        
        <CapabilitiesDetailView
          runnerId={runnerId}
          runnerName={runnerName}
          capabilities={capabilities}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
