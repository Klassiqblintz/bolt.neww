import type { LanguageModelV1 } from '@ai-sdk/provider';
import type { DiscoveredModel, ProviderType } from '~/lib/providers/types';

export interface AdapterProviderSpec {
  type: ProviderType;

  /** The endpoint to use, already validated by the url policy. */
  baseUrl: string;

  /** The model to use. */
  modelId: string;
}

export interface AdapterListSpec {
  type: ProviderType;

  /** The endpoint to use, already validated by the url policy. */
  baseUrl: string;
}

export interface ProviderAdapter {
  type: ProviderType;

  /** Creates the language model for a request. */
  createModel(spec: AdapterProviderSpec, apiKey: string): LanguageModelV1;

  /**
   * Lists the models the provider serves.
   *
   * Returns `undefined` when the provider does not support discovery.
   */
  listModels?(spec: AdapterListSpec, apiKey: string): Promise<DiscoveredModel[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
