import type { LanguageModelV1 } from '@ai-sdk/provider';
import { PROVIDER_DEFINITIONS, type DiscoveredModel, type ProviderType } from '~/lib/providers/types';
import { anthropicAdapter } from './anthropic';
import { openaiCompatibleAdapter } from './openai-compatible';
import { openrouterAdapter } from './openrouter';
import type { AdapterListSpec, AdapterProviderSpec, ProviderAdapter } from './types';

const ADAPTERS: Record<ProviderType, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  openrouter: openrouterAdapter,
  'openai-compatible': openaiCompatibleAdapter,
};

export function getAdapter(type: ProviderType): ProviderAdapter {
  return ADAPTERS[type];
}

/**
 * The endpoint a provider uses when the user did not configure one.
 */
export function getDefaultBaseUrl(type: ProviderType): string {
  return PROVIDER_DEFINITIONS[type].defaultBaseUrl ?? '';
}

/**
 * Creates the language model for a user configured provider.
 */
export function createUserModel(spec: AdapterProviderSpec, apiKey: string): LanguageModelV1 {
  return getAdapter(spec.type).createModel(spec, apiKey);
}

/**
 * Lists the models of a user configured provider.
 *
 * Returns `undefined` when the provider does not support discovery.
 */
export async function listUserModels(spec: AdapterListSpec, apiKey: string): Promise<DiscoveredModel[] | undefined> {
  const adapter = getAdapter(spec.type);

  if (!adapter.listModels) {
    return undefined;
  }

  return adapter.listModels(spec, apiKey);
}

export { ProviderError } from './types';
export type { AdapterListSpec, AdapterProviderSpec, ProviderAdapter } from './types';
