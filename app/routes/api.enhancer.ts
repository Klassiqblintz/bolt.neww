import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { StreamingTextResponse, parseStreamPart } from 'ai';
import { ModelUnavailableError, toAppError } from '~/lib/.server/llm/errors';
import { getProviderId } from '~/lib/.server/llm/provider';
import { redactValue } from '~/lib/.server/llm/redact';
import { streamText } from '~/lib/.server/llm/stream-text';
import { InvalidProviderError, resolveProvider } from '~/lib/.server/llm/user-provider';
import { parseProviderSpec } from '~/lib/.server/llm/provider-spec';
import { ERROR_CODES, formatError } from '~/lib/errors';
import { PROVIDER_KEY_HEADER, type ProviderRequestSpec } from '~/lib/providers/types';
import { stripIndents } from '~/utils/stripIndent';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

async function enhancerAction({ context, request }: ActionFunctionArgs) {
  /**
   * `context.cloudflare` is only present when running on Cloudflare. On other
   * runtimes (e.g. the Node build used by Vercel) the configuration is read
   * from the process environment instead.
   */
  const env = context.cloudflare?.env ?? ({} as Env);

  /**
   * Whether the request named a user managed provider. Hoisted so the error
   * handler can report the failure against the right kind of credential.
   */
  let userManaged = false;

  try {
    const { message, modelId, provider } =
      (await request.json<{
        message: string;
        modelId?: string;
        provider?: ProviderRequestSpec;
      }>()) ?? {};

    if (typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        formatError({
          code: ERROR_CODES.INVALID_REQUEST,
          message: 'There is no prompt to enhance.',
        }),
        { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      );
    }

    const userApiKey = request.headers.get(PROVIDER_KEY_HEADER) ?? undefined;
    const spec = parseProviderSpec(provider);

    userManaged = Boolean(spec);

    const resolved = resolveProvider({
      spec,
      apiKey: userApiKey,
      env,
      serverModelId: modelId,
    });

    const result = await streamText(
      [
        {
          role: 'user',
          content: stripIndents`
          I want you to improve the user prompt that is wrapped in \`<original_prompt>\` tags.

          IMPORTANT: Only respond with the improved prompt and nothing else!

          <original_prompt>
            ${message}
          </original_prompt>
        `,
        },
      ],
      env,
      { model: resolved.model, modelId: resolved.modelId, providerId: resolved.provider },
    );

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const processedChunk = decoder
          .decode(chunk)
          .split('\n')
          .filter((line) => line !== '')
          .map(parseStreamPart)
          .map((part) => part.value)
          .join('');

        controller.enqueue(encoder.encode(processedChunk));
      },
    });

    const transformedStream = result.toAIStream().pipeThrough(transformStream);

    return new StreamingTextResponse(transformedStream);
  } catch (error) {
    console.error('Prompt enhancement failed\n\n', redactValue(error));

    if (error instanceof InvalidProviderError || error instanceof ModelUnavailableError) {
      return new Response(
        formatError({
          code: error instanceof ModelUnavailableError ? ERROR_CODES.MODEL_UNAVAILABLE : ERROR_CODES.INVALID_REQUEST,
          message: error.message,
        }),
        { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      );
    }

    const appError = toAppError(error, { provider: getProviderId(env), userManaged });

    return new Response(formatError(appError), {
      status: appError.code === ERROR_CODES.NOT_CONFIGURED ? 503 : 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}
