/**
 * API Contract Diagnostic
 * 
 * Provides factual assessment of Orders API capabilities.
 * NO UI refactoring - just contract verification.
 */

import { 
  listRunners, 
  getRunner, 
  listServers,
  getProxyLogs,
  type ProxyRunner,
  type ProxyServer,
} from './ordersAdminProxy';

// ============================================
// API Contract Definition
// ============================================

export interface ApiEndpointStatus {
  endpoint: string;
  method: string;
  status: 'available' | 'missing' | 'error' | 'untested';
  description: string;
  required: boolean;
  lastTestedAt?: Date;
  errorMessage?: string;
}

export interface ApiFieldStatus {
  field: string;
  resource: 'runner' | 'server';
  status: 'present' | 'missing' | 'untested';
  description: string;
  required: boolean;
  sampleValue?: unknown;
}

export interface ApiContractDiagnostic {
  testedAt: Date;
  endpoints: ApiEndpointStatus[];
  fields: ApiFieldStatus[];
  summary: {
    endpointsAvailable: number;
    endpointsMissing: number;
    endpointsError: number;
    fieldsPresent: number;
    fieldsMissing: number;
    associationVerifiable: boolean;
    readinessLevel: 'full' | 'partial' | 'minimal';
  };
  recommendations: string[];
}

// ============================================
// Required API Endpoints (Minimum Viable)
// ============================================

const REQUIRED_ENDPOINTS: Omit<ApiEndpointStatus, 'status' | 'lastTestedAt' | 'errorMessage'>[] = [
  {
    endpoint: '/runners',
    method: 'GET',
    description: 'Liste tous les runners',
    required: true,
  },
  {
    endpoint: '/runners/:id',
    method: 'GET',
    description: 'Récupère un runner par ID',
    required: true,
  },
  {
    endpoint: '/runners',
    method: 'POST',
    description: 'Crée un nouveau runner',
    required: true,
  },
  {
    endpoint: '/runners/:id/token/reset',
    method: 'POST',
    description: 'Régénère le token du runner',
    required: false,
  },
  {
    endpoint: '/runners/:id',
    method: 'PATCH',
    description: 'Met à jour un runner (association)',
    required: true,
  },
  {
    endpoint: '/runners/:id',
    method: 'DELETE',
    description: 'Supprime un runner',
    required: false,
  },
  {
    endpoint: '/servers',
    method: 'GET',
    description: 'Liste tous les serveurs',
    required: true,
  },
  {
    endpoint: '/servers/:id',
    method: 'GET',
    description: 'Récupère un serveur par ID',
    required: false,
  },
  {
    endpoint: '/servers/:id/attach-runner',
    method: 'POST',
    description: 'Attache un runner à un serveur',
    required: false,
  },
];

// Required fields for association verification
const REQUIRED_FIELDS: Omit<ApiFieldStatus, 'status' | 'sampleValue'>[] = [
  {
    field: 'id',
    resource: 'runner',
    description: 'Identifiant unique du runner',
    required: true,
  },
  {
    field: 'name',
    resource: 'runner',
    description: 'Nom du runner',
    required: true,
  },
  {
    field: 'infrastructureId',
    resource: 'runner',
    description: 'ID du serveur associé (clé pour association)',
    required: true,
  },
  {
    field: 'serverId',
    resource: 'runner',
    description: 'ID du serveur (alias de infrastructureId)',
    required: false,
  },
  {
    field: 'status',
    resource: 'runner',
    description: 'Statut du runner',
    required: true,
  },
  {
    field: 'lastHeartbeatAt',
    resource: 'runner',
    description: 'Dernier heartbeat',
    required: true,
  },
  {
    field: 'id',
    resource: 'server',
    description: 'Identifiant unique du serveur',
    required: true,
  },
  {
    field: 'name',
    resource: 'server',
    description: 'Nom du serveur',
    required: true,
  },
  {
    field: 'runnerId',
    resource: 'server',
    description: 'ID du runner associé',
    required: true,
  },
];

// ============================================
// Diagnostic Functions
// ============================================

/**
 * Run full API contract diagnostic
 */
export async function runApiContractDiagnostic(): Promise<ApiContractDiagnostic> {
  console.log('[ApiContractDiagnostic] Starting diagnostic...');
  
  const endpoints: ApiEndpointStatus[] = [];
  const fields: ApiFieldStatus[] = [];
  let sampleRunner: ProxyRunner | null = null;
  let sampleServer: ProxyServer | null = null;

  // Test GET /runners
  try {
    const runnersResult = await listRunners();
    endpoints.push({
      ...REQUIRED_ENDPOINTS[0],
      status: runnersResult.success ? 'available' : 'error',
      lastTestedAt: new Date(),
      errorMessage: runnersResult.error,
    });

    if (runnersResult.success && runnersResult.data?.length) {
      sampleRunner = runnersResult.data[0];
    }
  } catch (err) {
    console.error('[ApiContractDiagnostic] GET /runners failed:', err);
    endpoints.push({
      ...REQUIRED_ENDPOINTS[0],
      status: 'error',
      lastTestedAt: new Date(),
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  // Test GET /runners/:id (if we have a sample runner)
  if (sampleRunner) {
    try {
      const singleRunnerResult = await getRunner(sampleRunner.id);
      endpoints.push({
        ...REQUIRED_ENDPOINTS[1],
        status: singleRunnerResult.success ? 'available' : 
                singleRunnerResult.statusCode === 404 ? 'missing' : 'error',
        lastTestedAt: new Date(),
        errorMessage: singleRunnerResult.success ? undefined : 
                      singleRunnerResult.statusCode === 404 ? 'Endpoint non implémenté (404)' : singleRunnerResult.error,
      });
    } catch (err) {
      console.error('[ApiContractDiagnostic] GET /runners/:id failed:', err);
      endpoints.push({
        ...REQUIRED_ENDPOINTS[1],
        status: 'missing',
        lastTestedAt: new Date(),
        errorMessage: 'Endpoint non disponible',
      });
    }
  } else {
    endpoints.push({
      ...REQUIRED_ENDPOINTS[1],
      status: 'untested',
      lastTestedAt: new Date(),
    });
  }

  // Test GET /servers
  try {
    const serversResult = await listServers();
    endpoints.push({
      endpoint: '/servers',
      method: 'GET',
      description: 'Liste tous les serveurs',
      required: true,
      status: serversResult.success ? 'available' : 
              serversResult.statusCode === 404 ? 'missing' : 'error',
      lastTestedAt: new Date(),
      errorMessage: serversResult.success ? undefined :
                    serversResult.statusCode === 404 ? 'Endpoint non implémenté (404)' : serversResult.error,
    });

    if (serversResult.success && serversResult.data?.length) {
      sampleServer = serversResult.data[0];
    }
  } catch (err) {
    console.error('[ApiContractDiagnostic] GET /servers failed:', err);
    endpoints.push({
      endpoint: '/servers',
      method: 'GET',
      description: 'Liste tous les serveurs',
      required: true,
      status: 'error',
      lastTestedAt: new Date(),
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  // Add remaining endpoints as untested (would require mutations to test)
  for (const ep of REQUIRED_ENDPOINTS.slice(2)) {
    if (!endpoints.find(e => e.endpoint === ep.endpoint && e.method === ep.method)) {
      endpoints.push({
        ...ep,
        status: 'untested',
        lastTestedAt: new Date(),
      });
    }
  }

  // Check fields from sample runner
  for (const fieldDef of REQUIRED_FIELDS.filter(f => f.resource === 'runner')) {
    if (!sampleRunner) {
      fields.push({ ...fieldDef, status: 'untested' });
      continue;
    }

    const value = sampleRunner[fieldDef.field as keyof ProxyRunner];
    const hasValue = value !== undefined && value !== null;
    
    fields.push({
      ...fieldDef,
      status: hasValue ? 'present' : 'missing',
      sampleValue: value,
    });
  }

  // Check fields from sample server
  for (const fieldDef of REQUIRED_FIELDS.filter(f => f.resource === 'server')) {
    if (!sampleServer) {
      fields.push({ ...fieldDef, status: 'untested' });
      continue;
    }

    const value = sampleServer[fieldDef.field as keyof ProxyServer];
    const hasValue = value !== undefined && value !== null;
    
    fields.push({
      ...fieldDef,
      status: hasValue ? 'present' : 'missing',
      sampleValue: value,
    });
  }

  // Calculate summary
  const endpointsAvailable = endpoints.filter(e => e.status === 'available').length;
  const endpointsMissing = endpoints.filter(e => e.status === 'missing').length;
  const endpointsError = endpoints.filter(e => e.status === 'error').length;
  const fieldsPresent = fields.filter(f => f.status === 'present').length;
  const fieldsMissing = fields.filter(f => f.status === 'missing' && f.required).length;

  // Association is verifiable if:
  // - GET /runners returns infrastructureId/serverId OR
  // - GET /servers returns runnerId
  const runnerHasInfraId = fields.some(
    f => f.resource === 'runner' && 
         (f.field === 'infrastructureId' || f.field === 'serverId') && 
         f.status === 'present'
  );
  const serverHasRunnerId = fields.some(
    f => f.resource === 'server' && f.field === 'runnerId' && f.status === 'present'
  );
  const associationVerifiable = runnerHasInfraId || serverHasRunnerId;

  // Determine readiness level
  let readinessLevel: 'full' | 'partial' | 'minimal';
  if (associationVerifiable && endpointsMissing === 0 && fieldsMissing === 0) {
    readinessLevel = 'full';
  } else if (associationVerifiable || endpointsAvailable >= 2) {
    readinessLevel = 'partial';
  } else {
    readinessLevel = 'minimal';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (!runnerHasInfraId) {
    recommendations.push('GET /runners doit retourner infrastructureId ou serverId pour chaque runner');
  }
  
  if (!serverHasRunnerId) {
    recommendations.push('GET /servers doit retourner runnerId (ou runner.id) pour chaque serveur');
  }
  
  if (endpoints.find(e => e.endpoint === '/runners/:id' && e.status !== 'available')) {
    recommendations.push('GET /runners/:id doit être implémenté pour vérification unitaire');
  }
  
  if (endpoints.find(e => e.endpoint === '/servers' && e.status !== 'available')) {
    recommendations.push('GET /servers doit exister pour synchroniser les serveurs avec l\'API');
  }
  
  if (!associationVerifiable) {
    recommendations.push('CRITIQUE: Impossible de vérifier les associations - l\'UI ne peut qu\'envoyer des requêtes "fire-and-forget"');
  }

  console.log('[ApiContractDiagnostic] Diagnostic complete:', {
    endpointsAvailable,
    endpointsMissing,
    fieldsPresent,
    fieldsMissing,
    associationVerifiable,
    readinessLevel,
  });

  return {
    testedAt: new Date(),
    endpoints,
    fields,
    summary: {
      endpointsAvailable,
      endpointsMissing,
      endpointsError,
      fieldsPresent,
      fieldsMissing,
      associationVerifiable,
      readinessLevel,
    },
    recommendations,
  };
}

/**
 * Check if a specific runner association is verifiable via API
 */
export async function checkRunnerAssociationVerifiable(
  runnerId: string,
  expectedInfraId: string
): Promise<{
  verifiable: boolean;
  confirmed: boolean;
  method: 'runner-field' | 'server-field' | 'get-runner' | 'none';
  message: string;
}> {
  // Try to get the runner directly
  const runnerResult = await getRunner(runnerId);
  
  if (runnerResult.success && runnerResult.data) {
    const runner = runnerResult.data;
    const actualInfraId = runner.infrastructureId || runner.serverId;
    
    if (actualInfraId) {
      return {
        verifiable: true,
        confirmed: actualInfraId === expectedInfraId,
        method: 'get-runner',
        message: actualInfraId === expectedInfraId 
          ? 'Association confirmée via GET /runners/:id'
          : `Association différente: attendu ${expectedInfraId}, reçu ${actualInfraId}`,
      };
    }
  }

  // Try from list of runners
  const listResult = await listRunners();
  if (listResult.success && listResult.data) {
    const runner = listResult.data.find(r => r.id === runnerId);
    if (runner) {
      const actualInfraId = runner.infrastructureId || runner.serverId;
      if (actualInfraId) {
        return {
          verifiable: true,
          confirmed: actualInfraId === expectedInfraId,
          method: 'runner-field',
          message: actualInfraId === expectedInfraId
            ? 'Association confirmée via GET /runners (champ infrastructureId)'
            : `Association différente: attendu ${expectedInfraId}, reçu ${actualInfraId}`,
        };
      }
    }
  }

  // Try from servers list
  const serversResult = await listServers();
  if (serversResult.success && serversResult.data) {
    const server = serversResult.data.find(s => s.id === expectedInfraId);
    if (server?.runnerId) {
      return {
        verifiable: true,
        confirmed: server.runnerId === runnerId,
        method: 'server-field',
        message: server.runnerId === runnerId
          ? 'Association confirmée via GET /servers (champ runnerId)'
          : `Runner différent associé au serveur: ${server.runnerId}`,
      };
    }
  }

  return {
    verifiable: false,
    confirmed: false,
    method: 'none',
    message: 'Association non vérifiable - API ne retourne pas les champs d\'association',
  };
}

/**
 * Get formatted diagnostic report
 */
export function formatDiagnosticReport(diagnostic: ApiContractDiagnostic): string {
  const lines: string[] = [
    `=== API Contract Diagnostic ===`,
    `Testé le: ${diagnostic.testedAt.toLocaleString()}`,
    ``,
    `== Endpoints ==`,
  ];

  for (const ep of diagnostic.endpoints) {
    const icon = ep.status === 'available' ? '✅' : 
                 ep.status === 'missing' ? '❌' : 
                 ep.status === 'error' ? '⚠️' : '❓';
    lines.push(`${icon} ${ep.method} ${ep.endpoint} - ${ep.description}`);
    if (ep.errorMessage) {
      lines.push(`   Error: ${ep.errorMessage}`);
    }
  }

  lines.push('', '== Champs (Runner) ==');
  for (const field of diagnostic.fields.filter(f => f.resource === 'runner')) {
    const icon = field.status === 'present' ? '✅' : 
                 field.status === 'missing' ? '❌' : '❓';
    const value = field.sampleValue !== undefined ? ` = ${JSON.stringify(field.sampleValue)}` : '';
    lines.push(`${icon} ${field.field}${value}`);
  }

  lines.push('', '== Champs (Server) ==');
  for (const field of diagnostic.fields.filter(f => f.resource === 'server')) {
    const icon = field.status === 'present' ? '✅' : 
                 field.status === 'missing' ? '❌' : '❓';
    const value = field.sampleValue !== undefined ? ` = ${JSON.stringify(field.sampleValue)}` : '';
    lines.push(`${icon} ${field.field}${value}`);
  }

  lines.push('', '== Résumé ==');
  lines.push(`Endpoints disponibles: ${diagnostic.summary.endpointsAvailable}`);
  lines.push(`Endpoints manquants: ${diagnostic.summary.endpointsMissing}`);
  lines.push(`Champs présents: ${diagnostic.summary.fieldsPresent}`);
  lines.push(`Champs manquants (requis): ${diagnostic.summary.fieldsMissing}`);
  lines.push(`Association vérifiable: ${diagnostic.summary.associationVerifiable ? 'OUI' : 'NON'}`);
  lines.push(`Niveau de préparation: ${diagnostic.summary.readinessLevel.toUpperCase()}`);

  if (diagnostic.recommendations.length > 0) {
    lines.push('', '== Recommandations API ==');
    for (const rec of diagnostic.recommendations) {
      lines.push(`• ${rec}`);
    }
  }

  return lines.join('\n');
}
