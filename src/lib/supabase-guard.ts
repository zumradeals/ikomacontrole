/**
 * SUPABASE ACCESS GUARD
 * 
 * This module provides runtime protection against forbidden direct Supabase access.
 * It logs warnings when code attempts to query protected tables directly.
 * 
 * Protected tables (must go through proxy):
 * - runners (source of truth: external API)
 * 
 * Allowed tables (local Supabase):
 * - orders (created by this control plane)
 * - infrastructures (managed locally)
 * - platform_instances, caddy_routes, etc.
 * 
 * Usage:
 * Import this module early in the application (e.g., in main.tsx)
 * to enable runtime monitoring.
 */

// Tables that MUST be accessed via proxy, not direct Supabase
const FORBIDDEN_DIRECT_ACCESS_TABLES = [
  'runners',
];

// Original from method reference
let originalFrom: ((table: string) => unknown) | null = null;
let isGuardInstalled = false;

/**
 * Install the Supabase access guard.
 * Call this once at application startup.
 */
export function installSupabaseGuard(supabaseClient: { from: (table: string) => unknown }): void {
  if (isGuardInstalled) {
    console.warn('[SupabaseGuard] Guard already installed');
    return;
  }

  originalFrom = supabaseClient.from.bind(supabaseClient);
  
  // Replace the from method with our guarded version
  (supabaseClient as { from: (table: string) => unknown }).from = function guardedFrom(table: string) {
    if (FORBIDDEN_DIRECT_ACCESS_TABLES.includes(table)) {
      const stack = new Error().stack;
      console.error(
        `[FORBIDDEN_DIRECT_SUPABASE_ACCESS] Attempted direct access to "${table}" table.\n` +
        `This table must be accessed via the admin-proxy Edge Function.\n` +
        `Use the appropriate hook (e.g., useRunners, useProxyRunners) instead.\n` +
        `Stack trace:\n${stack}`
      );
      
      // In development, we still allow the call but with a warning
      // In production, you could throw an error here
      if (import.meta.env.DEV) {
        console.warn(`[SupabaseGuard] DEV MODE: Allowing call to "${table}" for debugging, but this should be fixed.`);
      }
    }
    
    return originalFrom!(table);
  };

  isGuardInstalled = true;
  console.log('[SupabaseGuard] Guard installed. Protected tables:', FORBIDDEN_DIRECT_ACCESS_TABLES.join(', '));
}

/**
 * Check if a table access is forbidden.
 * Useful for manual checks in specific code paths.
 */
export function isForbiddenDirectAccess(table: string): boolean {
  return FORBIDDEN_DIRECT_ACCESS_TABLES.includes(table);
}

/**
 * Get list of forbidden tables.
 */
export function getForbiddenTables(): string[] {
  return [...FORBIDDEN_DIRECT_ACCESS_TABLES];
}
