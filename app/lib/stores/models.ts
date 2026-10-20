import { map } from 'nanostores';
import type { ModelInfo, ProviderId } from '~/lib/models';

export interface ModelsState {
  /** The provider the server is configured for. */
  provider: ProviderId | undefined;

  /** The models the client may choose from. */
  models: ModelInfo[];

  /** The model the server uses when the client does not request one. */
  defaultModelId: string | undefined;

  /**
   * A restored selection that is not part of the catalogue of the configured
   * provider. It is shown with a warning instead of being silently replaced.
   */
  unavailableModelId?: string;

  /** Whether the catalogue has been loaded. */
  loaded: boolean;
}

export const modelsStore = map<ModelsState>({
  provider: undefined,
  models: [],
  defaultModelId: undefined,
  loaded: false,
});
