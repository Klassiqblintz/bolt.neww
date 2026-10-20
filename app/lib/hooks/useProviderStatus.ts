import { useEffect, useState } from 'react';

/**
 * Checks whether the AI provider is configured on the server.
 *
 * Returns `undefined` while the check is in flight, `true` when the provider
 * is ready and `false` when it is not configured.
 */
export function useProviderStatus() {
  const [configured, setConfigured] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const response = await fetch('/api/status');

        if (!response.ok) {
          throw new Error(`Status check failed with status ${response.status}`);
        }

        const data = (await response.json()) as { configured?: boolean };

        if (!cancelled) {
          setConfigured(Boolean(data.configured));
        }
      } catch (error) {
        console.error('Failed to check the provider status', error);

        /**
         * We do not know whether the provider is configured, so we do not show
         * a warning. The actual request will report the problem if it fails.
         */
        if (!cancelled) {
          setConfigured(undefined);
        }
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, []);

  return configured;
}
