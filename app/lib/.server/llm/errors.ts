import { ERROR_CODES, type AppError, type ErrorCode } from '~/lib/errors';

/**
 * Maps an error thrown by the AI provider to a safe, actionable message.
 *
 * The raw error is only written to the server log. Nothing that could contain
 * credentials or environment details is forwarded to the client.
 */
export function toAppError(error: unknown): AppError {
  if (isMissingApiKeyError(error)) {
    return {
      code: ERROR_CODES.NOT_CONFIGURED,
      message: 'The AI provider is not configured. Add ANTHROPIC_API_KEY to the server environment and try again.',
    };
  }

  const status = getUpstreamStatus(error);

  switch (status) {
    case 401:
    case 403: {
      return {
        code: ERROR_CODES.INVALID_API_KEY,
        message: 'The configured ANTHROPIC_API_KEY was rejected by the provider. Check that the key is valid.',
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

  return {
    code: ERROR_CODES.UNKNOWN,
    message: 'The request failed. Please try again.',
  };
}

/**
 * The Anthropic SDK throws when no API key is available. The message is
 * matched instead of the error type because the SDK does not export a stable
 * error class for it.
 */
function isMissingApiKeyError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /api key is missing|apiKey.*missing|ANTHROPIC_API_KEY/i.test(error.message);
}

function getUpstreamStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as {
    statusCode?: number;
    status?: number;
    response?: { status?: number };
    cause?: { status?: number };
  };

  return candidate.statusCode ?? candidate.status ?? candidate.response?.status ?? candidate.cause?.status;
}

export function isErrorCode(value: string): value is ErrorCode {
  return Object.values(ERROR_CODES).includes(value as ErrorCode);
}
