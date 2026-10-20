import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getAPIKey } from '~/lib/.server/llm/api-key';

/**
 * Reports whether the AI provider is configured.
 *
 * The client uses this to tell the user up front that code generation is
 * unavailable, instead of only failing after they have typed a prompt.
 *
 * The response never contains the key itself, only whether one is present.
 */
export async function loader({ context }: LoaderFunctionArgs) {
  const env = context.cloudflare?.env ?? ({} as Env);

  return json(
    {
      configured: Boolean(getAPIKey(env)),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
