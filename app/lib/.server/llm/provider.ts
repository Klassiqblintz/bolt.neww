import { env } from 'node:process';
import { isProviderId, type ProviderId } from '~/lib/models';

/**
 * Reads a configuration value from the environment.
 *
 * On Cloudflare the values come from the worker bindings (`cloudflareEnv`), on
 * every other runtime (for example the Node build used by Vercel) they come
 * from the process environment. The process environment takes precedence, so
 * a deployment can override a binding.
 */
export function readEnvValue(name: string, cloudflareEnv: Env): string | undefined {
  const bindings = cloudflareEnv as unknown as Record<string, string | undefined>;

  const value = (env as Record<string, string | undefined>)[name] ?? bindings[name];

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * The provider the server talks to. Configured with `AI_PROVIDER`, defaulting
 * to Anthropic so existing deployments keep working.
 */
export function getProviderId(cloudflareEnv: Env): ProviderId {
  const configured = readEnvValue('AI_PROVIDER', cloudflareEnv)?.toLowerCase();

  if (isProviderId(configured)) {
    return configured;
  }

  return 'anthropic';
}

/**
 * The name of the environment variable that holds the API key of a provider.
 */
export function getApiKeyEnvName(provider: ProviderId): string {
  return provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'ANTHROPIC_API_KEY';
}
