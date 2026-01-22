/**
 * PLAYBOOKS MODULE - LEGACY WRAPPER
 * 
 * ⚠️ DEPRECATION NOTICE ⚠️
 * This module wraps the legacy hardcoded playbook catalog.
 * The source of truth is now the dynamic API: GET /v1/playbooks
 * 
 * Use the usePlaybooks() hook from '@/hooks/usePlaybooks' for new code.
 * This wrapper exists only for backward compatibility with existing UI components.
 * 
 * Migration Plan:
 * 1. New components → usePlaybooks() hook (dynamic API)
 * 2. Existing components → this wrapper (legacy compatibility)
 * 3. Future: Remove legacy files once all consumers migrated
 */

// Re-export all types and constants from legacy module
export {
  type Playbook,
  type PlaybookLevel,
  type PlaybookRisk,
  type PlaybookPrerequisite,
  ALL_PLAYBOOKS,
  PLAYBOOK_GROUPS,
  getPlaybookById,
  getPlaybooksByLevel,
  getPlaybooksByGroup,
} from './playbooks.legacy';

// Export a flag indicating legacy mode
export const USING_LEGACY_CATALOG = true;

/**
 * @deprecated Use usePlaybooks() hook instead
 * This function is kept for backward compatibility only.
 */
export function isLegacyMode(): boolean {
  console.warn(
    '[playbooks] Using legacy hardcoded catalog. ' +
    'Migrate to usePlaybooks() hook for dynamic API data.'
  );
  return true;
}
