import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { toAppError } from '~/lib/.server/llm/errors';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { getProviderId } from '~/lib/.server/llm/provider';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import { ERROR_CODES, formatError } from '~/lib/errors';

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

  try {
    const { messages, modelId } = await request.json<{ messages: Messages; modelId?: string }>();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        formatError({
          code: ERROR_CODES.INVALID_REQUEST,
          message: 'The request did not contain any messages.',
        }),
        { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      );
    }

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

        const result = await streamText(messages, cloudflareEnv, modelId, options);

        return stream.switchSource(result.toAIStream());
      },
    };

    const result = await streamText(messages, cloudflareEnv, modelId, options);

    stream.switchSource(result.toAIStream());

    return new Response(stream.readable, {
      status: 200,
      headers: {
        contentType: 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Chat request failed\n\n', error);

    const appError = toAppError(error, { provider: getProviderId(cloudflareEnv) });

    return new Response(formatError(appError), {
      status: appError.code === ERROR_CODES.NOT_CONFIGURED ? 503 : 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}
