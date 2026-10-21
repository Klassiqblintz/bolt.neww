import { useEffect } from 'react';
import type { ModelInfo, ProviderId } from '~/lib/models';
import { modelsStore } from '~/lib/stores/models';
import { initSelectionPersistence, revalidateSelectedModel } from '~/lib/stores/selection';

/**
 * Loads the models of the configured provider from the server and restores
 * the persisted model selection.
 *
 * The client never hard codes a model list, it only shows what the server
 * reports, so the selector always matches the deployed configuration.
 */
export function useModels() {
  useEffect(() => {
    /**
     * Restores the saved provider/model pair and clears a model that belongs
     * to a different provider. Started before the catalogue arrives so a
     * request never leaves the composer with a stale selection.
     */
    initSelectionPersistence();

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

        /**
         * Replacing the catalogue clears the unavailable warning along with
         * the rest of the store, so the selected model is checked against the
         * new list. A model the provider no longer offers is reported instead
         * of being left to fail silently on the next request.
         */
        revalidateSelectedModel();

        /**
         * The selected model is intentionally never set from the catalogue.
         * The saved selection is restored by the selection persistence
         * (validated against the provider it was picked for), and the server
         * falls back to its own default while nothing is selected. A catalogue
         * load can therefore never overwrite a valid saved selection with an
         * empty or temporary default.
         */
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
