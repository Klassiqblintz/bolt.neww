/**
 * Error handling shared between the server routes and the client.
 *
 * The server responds with a plain text body of the form
 * `[code] human readable message` so that it stays readable both in the
 * browser network tab and after being parsed by the AI SDK (which turns a non
 * OK response into `new Error(await response.text())`).
 */

export const ERROR_CODES = {
  /** No API key is configured for the AI provider. */

  NOT_CONFIGURED: 'not_configured',

  /** The configured API key was rejected by the provider. */

  INVALID_API_KEY: 'invalid_api_key',

  /** The provider rejected the selected model. */

  MODEL_UNAVAILABLE: 'model_unavailable',

  /** The provider rate limited the request. */

  RATE_LIMITED: 'rate_limited',

  /** The request itself was invalid. */

  INVALID_REQUEST: 'invalid_request',

  /** The provider failed for an unknown reason. */

  PROVIDER_ERROR: 'provider_error',

  /** Anything we could not classify. */

  UNKNOWN: 'unknown',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface AppError {
  code: ErrorCode;
  message: string;
}

const CODE_PATTERN = /^\[([a-z_]+)\]\s*(.*)$/s;

/**
 * Formats an error for the wire. The code prefix lets the client react to
 * specific problems (e.g. showing a persistent hint for a missing API key)
 * without parsing prose.
 */
export function formatError(error: AppError): string {
  return `[${error.code}] ${error.message}`;
}

/**
 * Parses an error body that was produced by {@link formatError}. Unknown
 * formats are returned as a generic error so that the message is still shown
 * to the user instead of being swallowed.
 */
export function parseError(text: string | undefined | null): AppError {
  const raw = (text ?? '').trim();

  if (!raw) {
    return { code: ERROR_CODES.UNKNOWN, message: 'The request failed. Please try again.' };
  }

  const match = raw.match(CODE_PATTERN);

  if (match) {
    const [, code, message] = match;

    if (Object.values(ERROR_CODES).includes(code as ErrorCode) && message) {
      return { code: code as ErrorCode, message };
    }
  }

  return { code: ERROR_CODES.UNKNOWN, message: raw };
}
