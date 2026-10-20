import { ERROR_CODES, type AppError, type ErrorCode } from '~/lib/errors';
import { getApiKeyEnvName } from './provider';
import { redactSecrets } from './redact';
import type { ProviderId } from '~/lib/models';

export interface ProviderErrorContext {
  /** The provider the request was sent to, used to name the right variable. */
  provider: ProviderId;

  /** Whether the request used a user managed provider instead of the server key. */
  userManaged?: boolean;
}

/** Thrown when the requested model does not belong to the acting provider. */
export class ModelUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelUnavailableError';
  }
}

/**
 * Maps an error thrown by the AI provider to a safe, actionable message.
 *
 * The raw error is only written to the server log. Nothing that could contain
 * credentials or environment details is forwarded to the client.
 */
export function toAppError(error: unknown, context: ProviderErrorContext = { provider: 'anthropic' }): AppError {
  const keyVariable = getApiKeyEnvName(context.provider);

  if (error instanceof ModelUnavailableError) {
    return {
      code: ERROR_CODES.MODEL_UNAVAILABLE,
      message: error.message,
    };
  }

  if (isMissingApiKeyError(error)) {
    return {
      code: ERROR_CODES.NOT_CONFIGURED,
      message: context.userManaged
        ? 'The selected provider has no working API key. Open AI providers and check the key.'
        : `The AI provider is not configured. Add ${keyVariable} to the server environment and try again.`,
    };
  }

  const status = getUpstreamStatus(error);

  switch (status) {
    case 401:
    case 403: {
      return {
        code: ERROR_CODES.INVALID_API_KEY,
        message: context.userManaged
          ? 'The provider rejected your API key. Check that the key is valid and still active.'
          : `The configured ${keyVariable} was rejected by the provider. Check that the key is valid.`,
      };
    }
    case 402: {
      return {
        code: ERROR_CODES.PAYMENT_REQUIRED,
        message:
          'The provider needs credits or a subscription for this model. Check the billing of your provider account.',
      };
    }
    case 404: {
      return {
        code: ERROR_CODES.MODEL_UNAVAILABLE,
        message: 'The selected model is not available for this API key. Pick another model and try again.',
      };
    }
    case 413: {
      return {
        code: ERROR_CODES.INVALID_REQUEST,
        message: 'The request was too large for the provider. Try a shorter prompt.',
      };
    }
    case 429: {
      return {
        code: ERROR_CODES.RATE_LIMITED,
        message: 'The AI provider is rate limiting this key. Wait a moment and try again.',
      };
    }
    case 400: {
      return {
        code: ERROR_CODES.INVALID_REQUEST,
        message: 'The provider rejected the request. Try rephrasing your prompt.',
      };
    }
    default: {
      break;
    }
  }

  if (status && status >= 500) {
    return {
      code: ERROR_CODES.PROVIDER_ERROR,
      message: 'The AI provider is currently unavailable. Please try again in a moment.',
    };
  }

  /**
   * The upstream reason is surfaced when it is safe to do so, so the user sees
   * why the request failed instead of a bare "try again". It is redacted and
   * truncated, and it never contains key material.
   */
  const detail = getUpstreamMessage(error);

  return {
    code: ERROR_CODES.UNKNOWN,
    message: detail ? `The request failed: ${detail}` : 'The request failed. Please try again.',
  };
}

/**
 * The AI SDK retries retryable failures and then throws a `RetryError` that
 * wraps the original provider error in `lastError`/`errors` instead of
 * exposing a status code directly. Without unwrapping that wrapper every
 * upstream 5xx (and every rate limit that exhausted the retries) collapsed
 * into an unclassified error with no useful message.
 */
function getUpstreamStatus(error: unknown, depth = 0): number | undefined {
  if (!error || typeof error !== 'object' || depth > 5) {
    return undefined;
  }

  const candidate = error as {
    statusCode?: unknown;
    status?: unknown;
    response?: { status?: unknown };
    lastError?: unknown;
    errors?: unknown;
    cause?: unknown;
  };

  const direct = [candidate.statusCode, candidate.status, candidate.response?.status].find(
    (value): value is number => typeof value === 'number',
  );

  if (direct !== undefined) {
    return direct;
  }

  const nested: unknown[] = [];

  if (candidate.lastError) {
    nested.push(candidate.lastError);
  }

  if (Array.isArray(candidate.errors) && candidate.errors.length > 0) {
    nested.push(candidate.errors[candidate.errors.length - 1]);
  }

  if (candidate.cause) {
    nested.push(candidate.cause);
  }

  for (const entry of nested) {
    const status = getUpstreamStatus(entry, depth + 1);

    if (status !== undefined) {
      return status;
    }
  }

  return undefined;
}

const MAX_DETAIL_LENGTH = 240;

/**
 * A short, redacted description of what the upstream provider reported.
 *
 * Returns `undefined` when nothing useful can be extracted, so the generic
 * fallback message is used instead of noise.
 */
export function getUpstreamMessage(error: unknown, depth = 0): string | undefined {
  if (!error || typeof error !== 'object' || depth > 5) {
    return undefined;
  }

  const candidate = error as {
    message?: unknown;
    responseBody?: unknown;
    lastError?: unknown;
    errors?: unknown;
    cause?: unknown;
  };

  const fromBody = parseResponseBody(candidate.responseBody);

  if (fromBody) {
    return fromBody;
  }

  if (typeof candidate.message === 'string' && candidate.message.trim() && !isMissingApiKeyError(error)) {
    return truncate(redactSecrets(candidate.message.trim()));
  }

  const nested: unknown[] = [];

  if (candidate.lastError) {
    nested.push(candidate.lastError);
  }

  if (Array.isArray(candidate.errors) && candidate.errors.length > 0) {
    nested.push(candidate.errors[candidate.errors.length - 1]);
  }

  if (candidate.cause) {
    nested.push(candidate.cause);
  }

  for (const entry of nested) {
    const detail = getUpstreamMessage(entry, depth + 1);

    if (detail) {
      return detail;
    }
  }

  return undefined;
}

/**
 * Reads the error message out of a raw upstream response body. Providers
 * report errors either as `{"error": {"message": "..."}}` (OpenAI compatible)
 * or as `{"error": {"type": "..."}}` (Anthropic).
 */
function parseResponseBody(body: unknown): string | undefined {
  let parsed: unknown = body;

  if (typeof body === 'string') {
    if (!body.trim()) {
      return undefined;
    }

    try {
      parsed = JSON.parse(body);
    } catch {
      return truncate(redactSecrets(body.trim()));
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }

  const error = (parsed as { error?: { message?: unknown; type?: unknown } }).error;

  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const message = typeof error.message === 'string' ? error.message : typeof error.type === 'string' ? error.type : '';

  return message ? truncate(redactSecrets(message)) : undefined;
}

function truncate(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();

  return collapsed.length > MAX_DETAIL_LENGTH ? `${collapsed.slice(0, MAX_DETAIL_LENGTH - 1)}…` : collapsed;
}

/**
 * The Anthropic SDK throws when no API key is available. The OpenAI
 * compatible SDK throws the same kind of error. The message is matched
 * instead of the error type because the SDKs do not export a stable error
 * class for it.
 */
function isMissingApiKeyError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /api key is missing|apiKey.*missing|ANTHROPIC_API_KEY|OPENROUTER_API_KEY/i.test(error.message);
}

export function isErrorCode(value: string): value is ErrorCode {
  return Object.values(ERROR_CODES).includes(value as ErrorCode);
}
