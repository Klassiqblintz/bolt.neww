import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getProviderConfig } from '~/lib/.server/llm/model';
import { getApiKeyEnvName, getProviderId } from '~/lib/.server/llm/provider';

/**
 * Reports whether the AI provider is configured.
 *
 * The client uses this to tell the user up front that code generation is
 * unavailable, instead of only failing after they have typed a prompt.
 *
 * The response never contains the key itself, only whether one is present.
 */
export async function loader({ context }: LoaderFunctionArgs) {
  const cloudflareEnv = context.cloudflare?.env ?? ({} as Env);

  const provider = getProviderId(cloudflareEnv);
  const config = getProviderConfig(cloudflareEnv);

  return json(
    {
      configured: Boolean(config.apiKey),
      provider,

      /**
       * The name of the environment variable the operator has to set. It is
       * the name of the variable, never its value.
       */
      apiKeyEnvName: getApiKeyEnvName(provider),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
