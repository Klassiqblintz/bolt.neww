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

export function streamText(messages: Messages, env: Env, modelId?: string, options?: StreamingOptions) {
  const config = getProviderConfig(env);

  return _streamText({
    model: getLanguageModel(env, modelId),
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    headers: getProviderHeaders(config.id),
    messages: convertToCoreMessages(messages),
    ...options,
  });
}

/**
 * Provider specific request headers.
 *
 * The beta header only exists for Anthropic models, sending it to another
 * provider would be rejected.
 */
function getProviderHeaders(provider: 'anthropic' | 'openrouter'): Record<string, string> {
  if (provider === 'anthropic') {
    return {
      'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    };
  }

  return {};
}
