import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import type { DiscoveredModel } from '~/lib/providers/types';
import { ProviderError, type AdapterListSpec, type AdapterProviderSpec, type ProviderAdapter } from './types';

interface OpenRouterPricing {
  prompt?: string;
  completion?: string;
  request?: string;
  image?: string;
}

interface OpenRouterModelEntry {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: OpenRouterPricing;
  supported_parameters?: string[];
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModelEntry[];
}

/**
 * The OpenRouter pricing values are strings, "0" means the model is free.
 */
function isZeroPrice(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed === 0;
}

/**
 * Adapter for OpenRouter.
 *
 * OpenRouter speaks the OpenAI chat completions API, so the OpenAI provider is
 * used in compatible mode. The model listing endpoint reports the pricing of
 * every model, which is the only source the free badge is derived from.
 */
export const openrouterAdapter: ProviderAdapter = {
  type: 'openrouter',

  createModel(spec: AdapterProviderSpec, apiKey: string): LanguageModelV1 {
    const openrouter = createOpenAI({
      apiKey,
      baseURL: spec.baseUrl,
      compatibility: 'compatible',
    });

    return openrouter(spec.modelId);
  },

  async listModels(spec: AdapterListSpec, apiKey: string): Promise<DiscoveredModel[]> {
    const response = await fetch(`${spec.baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new ProviderError('The provider rejected the model request.', response.status);
    }

    const data = (await response.json()) as OpenRouterModelsResponse;

    return (data.data ?? []).map((model) => {
      const pricing = model.pricing;

      /**
       * A model is only free when the provider reports a price of exactly
       * zero for both directions.
       */
      const isFree = pricing !== undefined && isZeroPrice(pricing.prompt) && isZeroPrice(pricing.completion);

      const supportsTools = model.supported_parameters?.includes('tools');

      return {
        id: model.id,
        label: model.name ?? model.id,
        contextLength: model.context_length,
        supportsTools,
        isFree,
      };
    });
  },
};
