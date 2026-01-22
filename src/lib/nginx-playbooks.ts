/**
 * NGINX PLAYBOOKS - LEGACY WRAPPER
 * 
 * ⚠️ DEPRECATION NOTICE ⚠️
 * This module wraps the legacy hardcoded Nginx playbook catalog.
 * The source of truth is now the dynamic API: GET /v1/playbooks
 * 
 * Use the usePlaybooks() hook from '@/hooks/usePlaybooks' for new code.
 */

// Re-export all from legacy module
export {
  NGINX_PLAYBOOKS,
  getNginxPlaybookById,
} from './nginx-playbooks.legacy';

// Export a flag indicating legacy mode
export const USING_LEGACY_NGINX_CATALOG = true;
