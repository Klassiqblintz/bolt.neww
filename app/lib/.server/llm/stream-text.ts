import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { getLanguageModel, getProviderConfig } from '~/lib/.server/llm/model';
import {
  ANTHROPIC_MAX_TOKENS_BETA,
  getAnthropicOutputLimit,
  needsAnthropicMaxTokensBeta,
} from '~/lib/.server/llm/model-limits';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';
import type { ProviderType } from '~/lib/providers/types';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

export interface StreamTextConfig {
  /**
   * The model to use. When it is not set, the server configured provider is
   * used with `modelId`.
   */
  model?: Parameters<typeof _streamText>[0]['model'];

  /** The model id of the server configured provider. */
  modelId?: string;

  /**
   * The provider the request is sent to.
   *
   * The provider decides which request headers and which output budget are
   * valid. It has to be the provider the request actually goes to, otherwise
   * a provider specific header is sent to a provider that rejects it, or the
   * header that the provider needs is left out.
   */
  providerId?: ProviderType;

  /**
   * Additional instructions that are appended to the system prompt.
   *
   * This is how the build mode and the planning mode reach the model without
   * ending up in the user's message.
   */
  system?: string;
}

/**
 * Combines the base system prompt with the request specific instructions.
 */
function buildSystemPrompt(additional?: string): string {
  const base = getSystemPrompt();

  return additional ? `${base}\n\n${additional}` : base;
}

/**
 * The number of output tokens the request asks for.
 *
 * The budget is capped at the limit of the model, because a provider rejects
 * a request that asks for more than the model can return.
 */
function getMaxTokens(providerId: ProviderType, modelId: string | undefined): number {
  if (providerId !== 'anthropic') {
    return MAX_TOKENS;
  }

  const limit = getAnthropicOutputLimit(modelId);

  return limit === undefined ? MAX_TOKENS : Math.min(MAX_TOKENS, limit);
}

/**
 * Provider specific request headers.
 *
 * Claude 3.5 Sonnet (20240620) only allows 8192 output tokens when the beta
 * header is sent. Without it the provider stops at 4096 and rejects the
 * request, so the header is part of making the request work at all.
 */
function getProviderHeaders(providerId: ProviderType, modelId: string | undefined): Record<string, string> {
  if (providerId !== 'anthropic' || !needsAnthropicMaxTokensBeta(modelId)) {
    return {};
  }

  return { 'anthropic-beta': ANTHROPIC_MAX_TOKENS_BETA };
}

export function streamText(messages: Messages, env: Env, config: StreamTextConfig = {}, options?: StreamingOptions) {
  const model = config.model ?? getLanguageModel(env, config.modelId);

  /**
   * The provider of the request. It is the provider the client asked for, or
   * the one the server is configured with.
   */
  const providerId = config.providerId ?? getProviderConfig(env).id;

  const system = config.system ?? options?.system;

  return _streamText({
    model,
    maxTokens: getMaxTokens(providerId, config.modelId),
    headers: getProviderHeaders(providerId, config.modelId),
    messages: convertToCoreMessages(messages),
    ...options,
    system: buildSystemPrompt(system),
  });
}
