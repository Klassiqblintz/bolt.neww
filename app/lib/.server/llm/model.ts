import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import { getDefaultModelId, getModelsForProvider, type ModelInfo, type ProviderId } from '~/lib/models';
import { getAPIKey } from '~/lib/.server/llm/api-key';
import { ModelUnavailableError } from '~/lib/.server/llm/errors';
import { getProviderId, readEnvValue } from '~/lib/.server/llm/provider';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface ProviderConfig {
  id: ProviderId;

  /** The API key of the provider, if one is configured. */
  apiKey: string | undefined;

  /** The models the client may choose from. */
  models: ModelInfo[];

  /** The model that is used when the client does not request a specific one. */
  defaultModelId: string;
}

/**
 * The models the operator explicitly allowed, configured with `AI_MODELS`.
 *
 * The value is a comma separated list of model ids. It restricts the built in
 * catalogue, it never introduces models that the provider does not serve.
 */
export function getAllowedModelIds(cloudflareEnv: Env): string[] | undefined {
  const configured = readEnvValue('AI_MODELS', cloudflareEnv);

  if (!configured) {
    return undefined;
  }

  const ids = configured
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return ids.length > 0 ? ids : undefined;
}

/**
 * Resolves the configuration of the active provider from the environment.
 */
export function getProviderConfig(cloudflareEnv: Env): ProviderConfig {
  const id = getProviderId(cloudflareEnv);
  const models = getModelsForProvider(id, getAllowedModelIds(cloudflareEnv));
  const providerDefault = getDefaultModelId(id);

  return {
    id,
    apiKey: getAPIKey(cloudflareEnv, id),
    models,

    /**
     * If the allow list removed the default model, the first remaining model
     * is used instead.
     */
    defaultModelId: models.find((model) => model.id === providerDefault)?.id ?? models[0]?.id ?? '',
  };
}

/**
 * Resolves the model of the configured provider that the request will use.
 *
 * When the client does not name a model, the default of the provider is used.
 * A model that is not part of the catalogue is reported instead of being
 * silently replaced by the default, because a surprise model switch produces
 * code the user never asked for.
 */
export function resolveConfiguredModelId(config: ProviderConfig, modelId?: string): string {
  /**
   * A provider without a usable model list cannot serve a request. Reporting
   * it here keeps an empty or misconfigured catalogue from silently producing
   * an empty model id, which the provider would reject with a confusing error.
   */
  if (config.models.length === 0) {
    throw new ModelUnavailableError(
      `The ${config.id} provider has no usable model. Check the AI_MODELS setting on the server or pick another provider.`,
    );
  }

  if (modelId === undefined || modelId === '') {
    return config.defaultModelId;
  }

  if (!config.models.some((model) => model.id === modelId)) {
    throw new ModelUnavailableError(
      `The model "${modelId}" is not available for the ${config.id} provider. Pick a model from the list and try again.`,
    );
  }

  return modelId;
}

/**
 * Creates the language model of the configured provider.
 *
 * The optional `modelId` comes from the client and is validated against the
 * catalogue of the *configured* provider, so a model of another provider can
 * never be requested.
 */
export function getLanguageModel(cloudflareEnv: Env, modelId?: string): LanguageModelV1 {
  const config = getProviderConfig(cloudflareEnv);
  const model = resolveConfiguredModelId(config, modelId);

  if (config.id === 'openrouter') {
    return createOpenRouterModel(cloudflareEnv, config, model);
  }

  return createAnthropicModel(cloudflareEnv, config, model);
}

function createAnthropicModel(cloudflareEnv: Env, config: ProviderConfig, modelId: string): LanguageModelV1 {
  const anthropic = createAnthropic({
    apiKey: config.apiKey,
  });

  return anthropic(modelId);
}

function createOpenRouterModel(cloudflareEnv: Env, config: ProviderConfig, modelId: string): LanguageModelV1 {
  const headers: Record<string, string> = {};

  /**
   * OpenRouter uses these optional headers for attribution on their dashboard.
   */
  const siteUrl = readEnvValue('OPENROUTER_SITE_URL', cloudflareEnv);
  const siteName = readEnvValue('OPENROUTER_SITE_NAME', cloudflareEnv);

  if (siteUrl) {
    headers['HTTP-Referer'] = siteUrl;
  }

  if (siteName) {
    headers['X-Title'] = siteName;
  }

  const openrouter = createOpenAI({
    apiKey: config.apiKey,
    baseURL: readEnvValue('OPENROUTER_BASE_URL', cloudflareEnv) ?? OPENROUTER_BASE_URL,
    headers,

    /**
     * OpenRouter implements the OpenAI chat completions API, so the provider
     * has to run in compatible mode.
     */
    compatibility: 'compatible',
  });

  return openrouter(modelId);
}
