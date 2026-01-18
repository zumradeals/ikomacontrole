/**
 * API Contract Status Component
 * 
 * Displays factual diagnostic of API capabilities.
 * Shows "API supports / missing" table.
 * NO UI refactoring - just contract verification display.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  HelpCircle,
  ChevronDown,
  FileWarning,
  Clipboard,
} from 'lucide-react';
import { 
  runApiContractDiagnostic, 
  formatDiagnosticReport,
  type ApiContractDiagnostic,
  type ApiEndpointStatus,
  type ApiFieldStatus,
} from '@/lib/api/apiContractDiagnostic';
import { toast } from '@/hooks/use-toast';

export function ApiContractStatus() {
  const [diagnostic, setDiagnostic] = useState<ApiContractDiagnostic | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const runDiagnostic = async () => {
    setIsLoading(true);
    try {
      const result = await runApiContractDiagnostic();
      setDiagnostic(result);
    } catch (error) {
      console.error('Diagnostic failed:', error);
      toast({
        title: 'Erreur diagnostic',
        description: 'Impossible de lancer le diagnostic API',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  const copyReport = () => {
    if (!diagnostic) return;
    const report = formatDiagnosticReport(diagnostic);
    navigator.clipboard.writeText(report);
    toast({
      title: 'Rapport copié',
      description: 'Le rapport de diagnostic a été copié dans le presse-papiers',
    });
  };

  const getStatusIcon = (status: ApiEndpointStatus['status'] | ApiFieldStatus['status']) => {
    switch (status) {
      case 'available':
      case 'present':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'missing':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'untested':
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ApiEndpointStatus['status'] | ApiFieldStatus['status']) => {
    switch (status) {
      case 'available':
      case 'present':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Disponible</Badge>;
      case 'missing':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Manquant</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Erreur</Badge>;
      case 'untested':
        return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">Non testé</Badge>;
    }
  };

  const getReadinessColor = (level: 'full' | 'partial' | 'minimal') => {
    switch (level) {
      case 'full': return 'bg-green-100 text-green-800 border-green-200';
      case 'partial': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'minimal': return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  if (!diagnostic && !isLoading) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="p-0 h-auto hover:bg-transparent">
                <div className="flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Contrat API Orders</CardTitle>
                  {diagnostic && (
                    <Badge 
                      variant="outline" 
                      className={getReadinessColor(diagnostic.summary.readinessLevel)}
                    >
                      {diagnostic.summary.readinessLevel === 'full' ? 'Complet' :
                       diagnostic.summary.readinessLevel === 'partial' ? 'Partiel' : 'Minimal'}
                    </Badge>
                  )}
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </Button>
            </CollapsibleTrigger>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={copyReport}
                disabled={!diagnostic}
              >
                <Clipboard className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={runDiagnostic}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Association Verifiable Warning */}
            {diagnostic && !diagnostic.summary.associationVerifiable && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Association non vérifiable</AlertTitle>
                <AlertDescription>
                  L'API ne retourne pas les champs nécessaires pour confirmer les associations runner↔serveur.
                  L'UI fonctionne en mode "fire-and-forget".
                </AlertDescription>
              </Alert>
            )}

            {/* Endpoints Table */}
            <div>
              <h4 className="text-sm font-medium mb-2">Endpoints</h4>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Méthode</th>
                      <th className="px-2 py-1.5 text-left">Endpoint</th>
                      <th className="px-2 py-1.5 text-left">Status</th>
                      <th className="px-2 py-1.5 text-left">Requis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostic?.endpoints.map((ep, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1.5 font-mono">{ep.method}</td>
                        <td className="px-2 py-1.5 font-mono">{ep.endpoint}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            {getStatusIcon(ep.status)}
                            {getStatusBadge(ep.status)}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          {ep.required ? (
                            <Badge variant="secondary">Requis</Badge>
                          ) : (
                            <span className="text-muted-foreground">Optionnel</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fields Table */}
            <div>
              <h4 className="text-sm font-medium mb-2">Champs retournés</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Runner Fields */}
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">Runner</h5>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        {diagnostic?.fields
                          .filter(f => f.resource === 'runner')
                          .map((field, i) => (
                            <tr key={i} className={i > 0 ? 'border-t' : ''}>
                              <td className="px-2 py-1 font-mono">{field.field}</td>
                              <td className="px-2 py-1">
                                {getStatusIcon(field.status)}
                              </td>
                              <td className="px-2 py-1 text-muted-foreground truncate max-w-[100px]">
                                {field.sampleValue !== undefined && field.sampleValue !== null
                                  ? String(field.sampleValue).substring(0, 20)
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Server Fields */}
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">Server</h5>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        {diagnostic?.fields
                          .filter(f => f.resource === 'server')
                          .map((field, i) => (
                            <tr key={i} className={i > 0 ? 'border-t' : ''}>
                              <td className="px-2 py-1 font-mono">{field.field}</td>
                              <td className="px-2 py-1">
                                {getStatusIcon(field.status)}
                              </td>
                              <td className="px-2 py-1 text-muted-foreground truncate max-w-[100px]">
                                {field.sampleValue !== undefined && field.sampleValue !== null
                                  ? String(field.sampleValue).substring(0, 20)
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {diagnostic?.recommendations && diagnostic.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Extensions API nécessaires</h4>
                <ul className="text-xs space-y-1">
                  {diagnostic.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary */}
            <div className="flex items-center gap-4 text-xs pt-2 border-t">
              <span>
                <strong>{diagnostic?.summary.endpointsAvailable}</strong> endpoints OK
              </span>
              <span>
                <strong>{diagnostic?.summary.endpointsMissing}</strong> manquants
              </span>
              <span>
                <strong>{diagnostic?.summary.fieldsPresent}</strong> champs présents
              </span>
              <span className={diagnostic?.summary.associationVerifiable ? 'text-green-600' : 'text-red-600'}>
                Association: {diagnostic?.summary.associationVerifiable ? '✅ Vérifiable' : '❌ Non vérifiable'}
              </span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
