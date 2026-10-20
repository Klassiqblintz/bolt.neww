import { useEffect } from 'react';
import type { ModelInfo, ProviderId } from '~/lib/models';
import { modelsStore } from '~/lib/stores/models';

/**
 * Loads the models of the configured provider from the server.
 *
 * The client never hard codes a model list, it only shows what the server
 * reports, so the selector always matches the deployed configuration.
 */
export function useModels() {
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/models');

        if (!response.ok) {
          throw new Error(`Failed to load the models (${response.status})`);
        }

        const data = (await response.json()) as {
          provider?: ProviderId;
          models?: ModelInfo[];
          defaultModelId?: string;
        };

        if (cancelled) {
          return;
        }

        modelsStore.set({
          provider: data.provider,
          models: data.models ?? [],
          defaultModelId: data.defaultModelId,
          loaded: true,
        });
      } catch (error) {
        console.error('Failed to load the available models', error);

        if (!cancelled) {
          modelsStore.setKey('loaded', true);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);
}
