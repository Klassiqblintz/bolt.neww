import type { ProviderId } from '~/lib/models';
import { getApiKeyEnvName, readEnvValue } from './provider';

/**
 * Returns the API key of the given provider.
 *
 * The key is only ever read on the server. It is never sent to the browser,
 * never written to a log and never included in an error message.
 */
export function getAPIKey(cloudflareEnv: Env, provider: ProviderId): string | undefined {
  return readEnvValue(getApiKeyEnvName(provider), cloudflareEnv);
}
