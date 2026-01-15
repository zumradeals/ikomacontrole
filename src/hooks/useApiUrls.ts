import { useMemo } from 'react';
import { useSettings } from './useSettings';

// Setting keys for API URLs
const SETTING_API_BASE_URL = 'orders_api_base_url';
const SETTING_API_V1_URL = 'orders_api_v1_url';

// Environment variables (highest priority)
const ENV_API_BASE_URL = import.meta.env.VITE_ORDERS_API_BASE_URL;
const ENV_API_V1_URL = import.meta.env.VITE_ORDERS_API_V1_URL;

// Default values (lowest priority)
const DEFAULT_API_BASE_URL = 'https://automate.ikomadigit.com';
const DEFAULT_API_V1_URL = 'https://automate.ikomadigit.com/v1';

/**
 * Hook to get API URLs with priority:
 * 1. Environment variables (VITE_ORDERS_API_BASE_URL, VITE_ORDERS_API_V1_URL)
 * 2. Database settings (orders_api_base_url, orders_api_v1_url)
 * 3. Default values (https://automate.ikomadigit.com)
 */
export function useApiUrls() {
  const { getSetting, isLoading } = useSettings();

  const urls = useMemo(() => {
    // Priority: env var > setting > default
    const baseUrl = ENV_API_BASE_URL || getSetting(SETTING_API_BASE_URL) || DEFAULT_API_BASE_URL;
    const v1Url = ENV_API_V1_URL || getSetting(SETTING_API_V1_URL) || DEFAULT_API_V1_URL;

    return {
      baseUrl,
      v1Url,
      installScriptUrl: `${baseUrl}/install-runner.sh`,
    };
  }, [getSetting]);

  /**
   * Validate that the install script URL doesn't contain /v1/
   * Returns error message if invalid, null if valid
   */
  const validateInstallUrl = useMemo(() => {
    if (urls.installScriptUrl.includes('/v1/')) {
      return 'Installer URL misconfigured: must not contain /v1/';
    }
    return null;
  }, [urls.installScriptUrl]);

  /**
   * Build the full install command for a runner
   */
  const buildInstallCommand = (token: string): string => {
    if (validateInstallUrl) {
      throw new Error(validateInstallUrl);
    }
    return `curl -sSL ${urls.installScriptUrl} | bash -s -- --token ${token} --api-url ${urls.baseUrl}`;
  };

  return {
    ...urls,
    isLoading,
    validateInstallUrl,
    buildInstallCommand,
  };
}

// Export constants for static access (when hooks can't be used)
export const API_DEFAULTS = {
  baseUrl: DEFAULT_API_BASE_URL,
  v1Url: DEFAULT_API_V1_URL,
};
