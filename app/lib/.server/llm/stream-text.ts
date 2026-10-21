import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { getLanguageModel, getProviderConfig } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';

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

export function streamText(messages: Messages, env: Env, config: StreamTextConfig = {}, options?: StreamingOptions) {
  const model = config.model ?? getLanguageModel(env, config.modelId);

  return _streamText({
    model,
    maxTokens: MAX_TOKENS,
    headers: getProviderHeaders(env, config),
    messages: convertToCoreMessages(messages),
    ...options,
    system: buildSystemPrompt(config.system),
  });
}

/**
 * Provider specific request headers.
 *
 * The beta header only exists for Anthropic models, sending it to another
 * provider would be rejected.
 */
function getProviderHeaders(env: Env, config: StreamTextConfig): Record<string, string> {
  /**
   * A user provider manages its own authentication, so no provider specific
   * header is added for it.
   */
  if (config.model) {
    return {};
  }

  if (getProviderConfig(env).id === 'anthropic') {
    return {
      'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    };
  }

  return {};
}
