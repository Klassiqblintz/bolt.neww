import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { getDefaultBaseUrl, listUserModels, ProviderError } from '~/lib/.server/llm/adapters';
import { redactValue } from '~/lib/.server/llm/redact';
import { checkProviderUrl, normalizeBaseUrl } from '~/lib/.server/llm/url-policy';
import { InvalidProviderError } from '~/lib/.server/llm/user-provider';
import { ERROR_CODES } from '~/lib/errors';
import { isProviderType, PROVIDER_KEY_HEADER, type ProviderRequestSpec } from '~/lib/providers/types';

/**
 * Lists the models of a user configured provider.
 *
 * The request carries the provider configuration and the API key. The key is
 * only used for this call, it is never stored and never logged.
 */
export async function action({ request }: ActionFunctionArgs) {
  let body: { provider?: ProviderRequestSpec } = {};

  try {
    body = (await request.json()) ?? {};
  } catch {
    return json(
      { error: { code: ERROR_CODES.INVALID_REQUEST, message: 'The request body is not valid JSON.' } },
      { status: 400 },
    );
  }

  const spec = body.provider;

  if (!spec || !isProviderType(spec.type)) {
    return json(
      { error: { code: ERROR_CODES.INVALID_REQUEST, message: 'The provider type is not supported.' } },
      { status: 400 },
    );
  }

  const apiKey = request.headers.get(PROVIDER_KEY_HEADER) ?? undefined;

  if (!apiKey) {
    return json(
      { error: { code: ERROR_CODES.NOT_CONFIGURED, message: 'The provider was selected but no API key was sent.' } },
      { status: 503 },
    );
  }

  const baseUrl = spec.baseUrl?.trim() || getDefaultBaseUrl(spec.type);

  if (!baseUrl) {
    return json(
      { error: { code: ERROR_CODES.INVALID_REQUEST, message: 'The provider needs an endpoint.' } },
      { status: 400 },
    );
  }

  const policy = checkProviderUrl(baseUrl);

  if (!policy.ok) {
    return json(
      { error: { code: ERROR_CODES.INVALID_REQUEST, message: policy.reason ?? 'The endpoint is not allowed.' } },
      { status: 400 },
    );
  }

  try {
    const models = await listUserModels(
      {
        type: spec.type,
        baseUrl: normalizeBaseUrl(baseUrl),
      },
      apiKey,
    );

    return json({ models: models ?? [] });
  } catch (error) {
    console.error('Model discovery failed\n\n', redactValue(error));

    if (error instanceof InvalidProviderError) {
      return json({ error: { code: ERROR_CODES.INVALID_REQUEST, message: error.message } }, { status: 400 });
    }

    if (error instanceof ProviderError) {
      const message =
        error.status === 401 || error.status === 403
          ? 'The API key was rejected by the provider.'
          : 'The provider could not list the models.';

      return json({ error: { code: ERROR_CODES.INVALID_API_KEY, message } }, { status: error.status ?? 502 });
    }

    return json({ error: { code: ERROR_CODES.UNKNOWN, message: 'The models could not be loaded.' } }, { status: 502 });
  }
}
