import { isProviderType, type ProviderRequestSpec } from '~/lib/providers/types';
import { InvalidProviderError } from './user-provider';

/**
 * Reads the provider description of a request.
 *
 * Returns `undefined` when the client did not name a provider, which is the
 * signal to use the provider the server is configured with.
 *
 * A provider that is present but malformed is reported instead of being
 * ignored: falling back to the server provider would send the request to a
 * different provider than the one the user picked, and the model that belongs
 * to the picked provider would be sent to the wrong API.
 */
export function parseProviderSpec(provider: unknown): ProviderRequestSpec | undefined {
  if (provider === undefined || provider === null) {
    return undefined;
  }

  if (typeof provider !== 'object') {
    throw new InvalidProviderError('The provider configuration is malformed.');
  }

  const spec = provider as Partial<ProviderRequestSpec>;

  if (!isProviderType(spec.type)) {
    throw new InvalidProviderError('The provider type is not supported.');
  }

  return {
    type: spec.type,
    baseUrl: typeof spec.baseUrl === 'string' ? spec.baseUrl : undefined,
    modelId: typeof spec.modelId === 'string' ? spec.modelId : undefined,
  };
}
