import { createAnthropic } from '@ai-sdk/anthropic';
import { getAPIKey } from '~/lib/.server/llm/api-key';
import { DEFAULT_MODEL_ID, isValidModelId } from '~/lib/models';

/**
 * Returns a configured Anthropic model. The optional `modelId` comes from the
 * client and is validated against the shared allow list; unknown or missing
 * ids fall back to the default model.
 */
export function getAnthropicModel(cloudflareEnv: Env, modelId?: string) {
  const anthropic = createAnthropic({
    apiKey: getAPIKey(cloudflareEnv),
  });

  return anthropic(isValidModelId(modelId) ? modelId : DEFAULT_MODEL_ID);
}
