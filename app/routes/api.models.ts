import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getProviderConfig } from '~/lib/.server/llm/model';

/**
 * Lists the models the configured provider serves and that the application can
 * use.
 *
 * The client uses this to only offer models that actually work, instead of a
 * hard coded list that could drift from the server configuration.
 */
export async function loader({ context }: LoaderFunctionArgs) {
  const cloudflareEnv = context.cloudflare?.env ?? ({} as Env);

  const config = getProviderConfig(cloudflareEnv);

  return json(
    {
      provider: config.id,
      models: config.models,
      defaultModelId: config.defaultModelId,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
