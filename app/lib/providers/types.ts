/**
 * Shared types for user configured AI providers.
 *
 * This module is safe to import from both the client and the server, it must
 * never contain secrets or server only logic.
 */

export type ProviderType = 'anthropic' | 'openrouter' | 'openai-compatible';

export interface ProviderDefinition {
  type: ProviderType;
  label: string;
  description: string;

  /** The endpoint that is used when the user does not set one. */
  defaultBaseUrl?: string;

  /** Whether the user may point the provider at a different endpoint. */
  supportsBaseUrl: boolean;

  /** Whether the provider offers a model listing endpoint. */
  supportsModelDiscovery: boolean;

  /** The name of the header the API key is sent in. */
  apiKeyHeader: string;

  /** A hint what the key looks like, never a real key. */
  keyHint: string;
  docsUrl?: string;
}

export const PROVIDER_DEFINITIONS: Record<ProviderType, ProviderDefinition> = {
  anthropic: {
    type: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models directly from Anthropic.',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    supportsBaseUrl: false,
    supportsModelDiscovery: true,
    apiKeyHeader: 'x-api-key',
    keyHint: 'sk-ant-…',
    docsUrl: 'https://docs.anthropic.com',
  },
  openrouter: {
    type: 'openrouter',
    label: 'OpenRouter',
    description: 'One key for many models, billed by the provider you pick.',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    supportsBaseUrl: true,
    supportsModelDiscovery: true,
    apiKeyHeader: 'Authorization',
    keyHint: 'sk-or-v1-…',
    docsUrl: 'https://openrouter.ai/docs',
  },
  'openai-compatible': {
    type: 'openai-compatible',
    label: 'OpenAI compatible',
    description: 'Any endpoint that speaks the OpenAI chat completions API.',
    supportsBaseUrl: true,
    supportsModelDiscovery: true,
    apiKeyHeader: 'Authorization',
    keyHint: 'sk-…',
    docsUrl: 'https://platform.openai.com/docs/api-reference/chat',
  },
};

export const PROVIDER_TYPES = Object.keys(PROVIDER_DEFINITIONS) as ProviderType[];

/**
 * The header the API key of a user provider is sent in.
 *
 * It is a custom header so it never collides with the authentication header
 * of the provider itself.
 */
export const PROVIDER_KEY_HEADER = 'x-bolt-provider-key';

export function isProviderType(value: unknown): value is ProviderType {
  return typeof value === 'string' && PROVIDER_TYPES.includes(value as ProviderType);
}

/**
 * The provider configuration as it is stored in the browser.
 *
 * The API key is never part of this object, only the encrypted material.
 */
export interface StoredProvider {
  id: string;
  type: ProviderType;

  /** A user chosen name for the provider. */
  name: string;

  /** The endpoint, only for providers that support a custom one. */
  baseUrl?: string;

  /** The encrypted API key. */
  encryptedKey: string;

  /** The salt used to derive the encryption key. */
  keySalt: string;

  /** The initialisation vector of the encrypted key. */
  keyIv: string;

  /** The model that is used for generation. */
  modelId?: string;
  createdAt: string;
  updatedAt: string;

  /** The result of the last connection test. */
  lastTestedAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
}

/**
 * The provider description that is sent with a request.
 *
 * It never contains the API key, that travels in a separate header.
 */
export interface ProviderRequestSpec {
  type: ProviderType;
  baseUrl?: string;
  modelId?: string;
}

/**
 * A model that was discovered at the provider.
 */
export interface DiscoveredModel {
  id: string;
  label: string;

  /** The context window, if the provider reports it. */
  contextLength?: number;

  /** Whether the provider reports tool support for the model. */
  supportsTools?: boolean;

  /**
   * Only true when the provider metadata explicitly reports that the model
   * has no usage cost. It is never inferred from the model name.
   */
  isFree: boolean;
}
