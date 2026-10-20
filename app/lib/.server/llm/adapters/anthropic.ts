import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import type { DiscoveredModel } from '~/lib/providers/types';
import { ProviderError, type AdapterListSpec, type AdapterProviderSpec, type ProviderAdapter } from './types';

const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicModelEntry {
  id: string;
  display_name?: string;
  type?: string;
}

interface AnthropicModelsResponse {
  data?: AnthropicModelEntry[];
}

/**
 * Adapter for the Anthropic messages API.
 */
export const anthropicAdapter: ProviderAdapter = {
  type: 'anthropic',

  createModel(spec: AdapterProviderSpec, apiKey: string): LanguageModelV1 {
    const anthropic = createAnthropic({
      apiKey,
      baseURL: spec.baseUrl,
    });

    return anthropic(spec.modelId);
  },

  async listModels(spec: AdapterListSpec, apiKey: string): Promise<DiscoveredModel[]> {
    const response = await fetch(`${spec.baseUrl}/models`, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
    });

    if (!response.ok) {
      throw new ProviderError('The provider rejected the model request.', response.status);
    }

    const data = (await response.json()) as AnthropicModelsResponse;

    return (data.data ?? []).map((model) => ({
      id: model.id,
      label: model.display_name ?? model.id,

      /**
       * Anthropic does not report pricing, so the free state stays unknown and
       * no free badge is shown.
       */
      isFree: false,
    }));
  },
};
