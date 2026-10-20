import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { StreamingTextResponse, parseStreamPart } from 'ai';
import { toAppError } from '~/lib/.server/llm/errors';
import { getProviderId } from '~/lib/.server/llm/provider';
import { streamText } from '~/lib/.server/llm/stream-text';
import { ERROR_CODES, formatError } from '~/lib/errors';
import { stripIndents } from '~/utils/stripIndent';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

async function enhancerAction({ context, request }: ActionFunctionArgs) {
  /**
   * `context.cloudflare` is only present when running on Cloudflare. On other
   * runtimes (e.g. the Node build used by Vercel) the API key is read from the
   * process environment instead.
   */
  const env = context.cloudflare?.env ?? ({} as Env);

  try {
    const { message, modelId } = await request.json<{ message: string; modelId?: string }>();

    if (typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        formatError({
          code: ERROR_CODES.INVALID_REQUEST,
          message: 'There is no prompt to enhance.',
        }),
        { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      );
    }

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
      modelId,
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
    console.error('Prompt enhancement failed\n\n', error);

    const appError = toAppError(error, { provider: getProviderId(env) });

    return new Response(formatError(appError), {
      status: appError.code === ERROR_CODES.NOT_CONFIGURED ? 503 : 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}
