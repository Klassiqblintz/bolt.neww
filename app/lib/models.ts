/**
 * Shared model definitions used by the client-side model selector and the
 * server-side AI routes.
 *
 * The catalog is grouped by provider so the client can only ever offer models
 * that the configured provider actually serves. The server validates the
 * requested model against the catalog of the *configured* provider and falls
 * back to that provider's default.
 */

export type ProviderId = 'anthropic' | 'openrouter';

export interface ModelInfo {
  id: string;
  label: string;
  provider: ProviderId;

  /** The model can be called with a tool definition. */
  supportsTools: boolean;

  /** The model can stream its response. */
  supportsStreaming: boolean;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  defaultModelId: string;
  models: ModelInfo[];
}

const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: 'claude-3-5-sonnet-20240620',
    label: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-3-opus-20240229',
    label: 'Claude 3 Opus',
    provider: 'anthropic',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-3-haiku-20240307',
    label: 'Claude 3 Haiku',
    provider: 'anthropic',
    supportsTools: true,
    supportsStreaming: true,
  },
];

/**
 * OpenRouter serves the models under a `provider/model` identifier. The list
 * can be overridden with the `AI_MODELS` environment variable, because
 * OpenRouter changes its catalogue regularly.
 */
const OPENROUTER_MODELS: ModelInfo[] = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    label: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    label: 'Claude 3.5 Haiku',
    provider: 'openrouter',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    provider: 'openrouter',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'openrouter',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'deepseek/deepseek-chat',
    label: 'DeepSeek Chat',
    provider: 'openrouter',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'mistralai/mistral-large',
    label: 'Mistral Large',
    provider: 'openrouter',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    label: 'Llama 3.1 70B',
    provider: 'openrouter',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    label: 'Qwen 2.5 72B',
    provider: 'openrouter',
    supportsTools: true,
    supportsStreaming: true,
  },
];

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    defaultModelId: 'claude-3-5-sonnet-20240620',
    models: ANTHROPIC_MODELS,
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultModelId: 'anthropic/claude-3.5-sonnet',
    models: OPENROUTER_MODELS,
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export function isProviderId(value: string | undefined): value is ProviderId {
  return !!value && PROVIDER_IDS.includes(value as ProviderId);
}

export function getProviderInfo(provider: ProviderId): ProviderInfo {
  return PROVIDERS[provider];
}

/**
 * The models a provider serves. The optional allow list restricts the
 * catalogue further, it never adds models that are not part of it.
 */
export function getModelsForProvider(provider: ProviderId, allowedModelIds?: string[]): ModelInfo[] {
  const models = PROVIDERS[provider].models;

  if (!allowedModelIds || allowedModelIds.length === 0) {
    return models;
  }

  return models.filter((model) => allowedModelIds.includes(model.id));
}

export function isValidModelId(provider: ProviderId, id: string | undefined): id is string {
  if (!id) {
    return false;
  }

  return PROVIDERS[provider].models.some((model) => model.id === id);
}

/**
 * The default model of the given provider.
 */
export function getDefaultModelId(provider: ProviderId): string {
  return PROVIDERS[provider].defaultModelId;
}
