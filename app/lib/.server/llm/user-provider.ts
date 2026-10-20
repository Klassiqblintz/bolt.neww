import type { LanguageModelV1 } from '@ai-sdk/provider';
import { isProviderType, type ProviderRequestSpec, type ProviderType } from '~/lib/providers/types';
import { createUserModel, getDefaultBaseUrl } from '~/lib/.server/llm/adapters';
import { getLanguageModel } from '~/lib/.server/llm/model';
import { getProviderId } from '~/lib/.server/llm/provider';
import { checkProviderUrl, normalizeBaseUrl } from '~/lib/.server/llm/url-policy';

export class InvalidProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProviderError';
  }
}

const MODEL_ID_PATTERN = /^[A-Za-z0-9._:/@+-]{1,200}$/;

/**
 * Validates a model identifier before it is sent to a provider.
 *
 * The identifier is used in a request body, so it must not contain control
 * characters or unexpected characters.
 */
export function validateModelId(modelId: string | undefined): string {
  const value = modelId?.trim();

  if (!value) {
    throw new InvalidProviderError('No model was selected. Pick a model in the dropdown or set one for this provider.');
  }

  if (!MODEL_ID_PATTERN.test(value)) {
    throw new InvalidProviderError('The model identifier contains unsupported characters.');
  }

  return value;
}

export interface ResolvedProvider {
  model: LanguageModelV1;
  provider: ProviderType;
  modelId: string;

  /** Where the configuration came from. */
  source: 'user' | 'server';
}

export interface ResolveProviderInput {
  /** The provider the client asked for, if any. */
  spec?: ProviderRequestSpec;

  /** The API key of the user provider, sent in a header. */
  apiKey?: string;

  /** The server environment, used for the fallback. */
  env: Env;

  /** The model id of the server configured provider. */
  serverModelId?: string;

  /** Whether http endpoints are allowed, only for local development. */
  allowInsecureUrls?: boolean;
}

/**
 * Resolves the provider for a request.
 *
 * When the client sends a provider configuration it is used, otherwise the
 * server configured provider is the fallback. A user configuration is never
 * silently replaced by the server default.
 */
export function resolveProvider({
  spec,
  apiKey,
  env,
  serverModelId,
  allowInsecureUrls = false,
}: ResolveProviderInput): ResolvedProvider {
  if (!spec) {
    const provider = getProviderId(env);

    return {
      model: getLanguageModel(env, serverModelId),
      provider,
      modelId: serverModelId ?? '',
      source: 'server',
    };
  }

  if (!isProviderType(spec.type)) {
    throw new InvalidProviderError('The provider type is not supported.');
  }

  if (!apiKey) {
    throw new InvalidProviderError('The provider was selected but no API key was sent.');
  }

  const definitionBaseUrl = getDefaultBaseUrl(spec.type);

  const rawBaseUrl = spec.baseUrl?.trim() || definitionBaseUrl;

  if (!rawBaseUrl) {
    throw new InvalidProviderError('The provider needs an endpoint.');
  }

  const policy = checkProviderUrl(rawBaseUrl, allowInsecureUrls);

  if (!policy.ok || !policy.url) {
    throw new InvalidProviderError(policy.reason ?? 'The endpoint is not allowed.');
  }

  const baseUrl = normalizeBaseUrl(policy.url.toString());

  /**
   * The model the client picked in the composer wins over the model stored on
   * the provider record. This is how a per-conversation selection reaches the
   * request instead of being silently ignored in favour of the provider default.
   * Without it, picking a model while a user provider is active had no effect,
   * and a provider without a stored model failed with "no model was selected".
   */
  const modelId = validateModelId(serverModelId || spec.modelId);

  return {
    model: createUserModel({ type: spec.type, baseUrl, modelId }, apiKey),
    provider: spec.type,
    modelId,
    source: 'user',
  };
}
