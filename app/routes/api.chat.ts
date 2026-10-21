import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { buildGenerationContext, DEFAULT_BUILD_MODE, isBuildMode } from '~/lib/buildModes';
import { ModelUnavailableError, toAppError } from '~/lib/.server/llm/errors';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { getProviderId } from '~/lib/.server/llm/provider';
import { parseProviderSpec } from '~/lib/.server/llm/provider-spec';
import { redactValue } from '~/lib/.server/llm/redact';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import { InvalidProviderError, resolveProvider } from '~/lib/.server/llm/user-provider';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import { ERROR_CODES, formatError } from '~/lib/errors';
import { PROVIDER_KEY_HEADER, type ProviderRequestSpec } from '~/lib/providers/types';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  /**
   * `context.cloudflare` is only present when running on Cloudflare. On other
   * runtimes (e.g. the Node build used by Vercel) the configuration is read
   * from the process environment instead.
   */
  const cloudflareEnv = context.cloudflare?.env ?? ({} as Env);

  const stream = new SwitchableStream();

  /**
   * Whether the request named a user managed provider. Hoisted so the error
   * handler can report the failure against the right kind of credential.
   */
  let userManaged = false;

  try {
    const { messages, modelId, provider, buildMode, planningMode } =
      (await request.json<{
        messages: Messages;
        modelId?: string;
        provider?: ProviderRequestSpec;
        buildMode?: string;
        planningMode?: boolean;
      }>()) ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        formatError({
          code: ERROR_CODES.INVALID_REQUEST,
          message: 'The request did not contain any messages.',
        }),
        { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      );
    }

    /**
     * The API key of a user provider is only used for this request. It is
     * never stored and never written to a log.
     */
    const userApiKey = request.headers.get(PROVIDER_KEY_HEADER) ?? undefined;
    const spec = parseProviderSpec(provider);

    userManaged = Boolean(spec);

    const resolved = resolveProvider({
      spec,
      apiKey: userApiKey,
      env: cloudflareEnv,
      serverModelId: modelId,
    });

    /**
     * The build mode and the planning mode steer the generation. They become
     * part of the system prompt, so the user's message stays exactly what the
     * user typed and the conversation never shows the instructions.
     */
    const systemContext = buildGenerationContext(
      isBuildMode(buildMode) ? buildMode : DEFAULT_BUILD_MODE,
      planningMode === true,
    );

    const options: StreamingOptions = {
      toolChoice: 'none',
      onFinish: async ({ text: content, finishReason }) => {
        if (finishReason !== 'length') {
          return stream.close();
        }

        if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
          throw Error('Cannot continue message: Maximum segments reached');
        }

        const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

        console.log(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

        messages.push({ role: 'assistant', content });
        messages.push({ role: 'user', content: CONTINUE_PROMPT });

        const result = await streamText(
          messages,
          cloudflareEnv,
          { model: resolved.model, modelId: resolved.modelId, providerId: resolved.provider, system: systemContext },
          options,
        );

        return stream.switchSource(result.toAIStream());
      },
    };

    const result = await streamText(
      messages,
      cloudflareEnv,
      { model: resolved.model, modelId: resolved.modelId, providerId: resolved.provider, system: systemContext },
      options,
    );

    stream.switchSource(result.toAIStream());

    return new Response(stream.readable, {
      status: 200,
      headers: {
        contentType: 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    /**
     * The error is redacted before it is logged, so that no key material can
     * end up in the server logs.
     */
    console.error('Chat request failed\n\n', redactValue(error));

    if (error instanceof InvalidProviderError || error instanceof ModelUnavailableError) {
      return new Response(
        formatError({
          code: error instanceof ModelUnavailableError ? ERROR_CODES.MODEL_UNAVAILABLE : ERROR_CODES.INVALID_REQUEST,
          message: error.message,
        }),
        { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      );
    }

    const appError = toAppError(error, { provider: getProviderId(cloudflareEnv), userManaged });

    return new Response(formatError(appError), {
      status: appError.code === ERROR_CODES.NOT_CONFIGURED ? 503 : 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}
