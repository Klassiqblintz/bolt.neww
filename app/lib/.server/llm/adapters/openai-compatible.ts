import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import type { DiscoveredModel } from '~/lib/providers/types';
import { ProviderError, type AdapterListSpec, type AdapterProviderSpec, type ProviderAdapter } from './types';

interface CompatibleModelEntry {
  id: string;
  name?: string;
  context_length?: number;
  context_window?: number;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
}

interface CompatibleModelsResponse {
  data?: CompatibleModelEntry[];
}

function isZeroPrice(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed === 0;
}

/**
 * Adapter for endpoints that speak the OpenAI chat completions API.
 *
 * The model listing is optional: many compatible endpoints do not implement
 * it, in that case the user enters the model identifier manually.
 */
export const openaiCompatibleAdapter: ProviderAdapter = {
  type: 'openai-compatible',

  createModel(spec: AdapterProviderSpec, apiKey: string): LanguageModelV1 {
    const provider = createOpenAI({
      apiKey,
      baseURL: spec.baseUrl,
      compatibility: 'compatible',
    });

    return provider(spec.modelId);
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

    const data = (await response.json()) as CompatibleModelsResponse;

    return (data.data ?? []).map((model) => {
      const contextLength = model.context_length ?? model.context_window;

      const supportsTools = model.supported_parameters?.includes('tools');

      return {
        id: model.id,
        label: model.name ?? model.id,
        contextLength,
        supportsTools,

        /**
         * Only endpoints that report a price of zero are marked as free.
         */
        isFree:
          model.pricing !== undefined && isZeroPrice(model.pricing.prompt) && isZeroPrice(model.pricing.completion),
      };
    });
  },
};
