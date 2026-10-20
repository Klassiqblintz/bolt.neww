import { describe, expect, it } from 'vitest';
import { ERROR_CODES, parseError, formatError } from '~/lib/errors';
import { getUpstreamMessage, ModelUnavailableError, toAppError } from '~/lib/.server/llm/errors';

/**
 * A stand-in for the `AI_RetryError` the AI SDK throws after its retries are
 * exhausted. It wraps the real provider error, which carries the status, and
 * exposes it through `lastError`/`errors` instead of a top level status.
 */
class RetryErrorStub extends Error {
  lastError: unknown;
  errors: unknown[];

  constructor(lastError: unknown) {
    super('Retry failed.');
    this.name = 'AI_RetryError';
    this.lastError = lastError;
    this.errors = [lastError];
  }
}

class APICallErrorStub extends Error {
  statusCode: number;
  responseBody: string;

  constructor(statusCode: number, message: string, responseBody = '') {
    super(message);
    this.name = 'AI_APICallError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

describe('upstream status unwrapping', () => {
  it('classifies a 404 that is wrapped in a retry error', () => {
    /**
     * This is the shape that produced the useless "The request failed. Please
     * try again." on the live deployment: the provider answered 404, the AI
     * SDK wrapped it, and the wrapper had no status of its own.
     */
    const error = new RetryErrorStub(new APICallErrorStub(404, 'model not found'));

    expect(toAppError(error, { provider: 'openrouter' }).code).toBe(ERROR_CODES.MODEL_UNAVAILABLE);
  });

  it('classifies a 5xx that exhausted the retries', () => {
    const error = new RetryErrorStub(new APICallErrorStub(502, 'bad gateway'));

    expect(toAppError(error, { provider: 'openrouter' }).code).toBe(ERROR_CODES.PROVIDER_ERROR);
  });

  it('classifies a rate limit that exhausted the retries', () => {
    const error = new RetryErrorStub(new APICallErrorStub(429, 'slow down'));

    expect(toAppError(error, { provider: 'openrouter' }).code).toBe(ERROR_CODES.RATE_LIMITED);
  });

  it('walks the cause chain', () => {
    const upstream = new APICallErrorStub(401, 'unauthorized');

    const wrapped = new Error('request failed', { cause: upstream });

    expect(toAppError(wrapped, { provider: 'anthropic' }).code).toBe(ERROR_CODES.INVALID_API_KEY);
  });

  it('reads the status out of the last entry of the errors list', () => {
    const error = { name: 'AI_RetryError', errors: [new Error('first'), new APICallErrorStub(429, 'rate limited')] };

    expect(toAppError(error, { provider: 'anthropic' }).code).toBe(ERROR_CODES.RATE_LIMITED);
  });
});

describe('billing required', () => {
  it('reports a 402 as a billing problem instead of a generic failure', () => {
    /**
     * OpenRouter answers 402 when the key has no credits left for a model.
     */
    const error = new APICallErrorStub(402, 'insufficient credits');

    const appError = toAppError(error, { provider: 'openrouter', userManaged: true });

    expect(appError.code).toBe(ERROR_CODES.PAYMENT_REQUIRED);
    expect(appError.message).toMatch(/credit|billing|subscription/i);
  });

  it('keeps the payment code on the wire format', () => {
    const parsed = parseError(formatError({ code: ERROR_CODES.PAYMENT_REQUIRED, message: 'needs credits' }));

    expect(parsed.code).toBe(ERROR_CODES.PAYMENT_REQUIRED);
  });
});

describe('upstream detail for unclassified errors', () => {
  it('surfaces a safe upstream message instead of a bare try again', () => {
    const error = new APICallErrorStub(0, 'The model is deprecated for this endpoint.');

    const appError = toAppError(error, { provider: 'openrouter' });

    expect(appError.code).toBe(ERROR_CODES.UNKNOWN);
    expect(appError.message).toContain('The model is deprecated for this endpoint.');
  });

  it('reads the message out of an OpenAI compatible error body', () => {
    const error = new APICallErrorStub(
      0,
      'call failed',
      JSON.stringify({ error: { message: 'no providers are available for this model' } }),
    );

    expect(getUpstreamMessage(error)).toBe('no providers are available for this model');
  });

  it('redacts key material from the upstream detail', () => {
    const error = new APICallErrorStub(0, 'invalid key sk-or-v1-abcdef1234567890 supplied');

    const appError = toAppError(error, { provider: 'openrouter' });

    expect(appError.message).not.toContain('sk-or-v1-abcdef1234567890');
    expect(appError.message).toContain('[redacted]');
  });

  it('truncates a very long upstream message', () => {
    const error = new APICallErrorStub(0, 'x'.repeat(1000));

    const appError = toAppError(error, { provider: 'openrouter' });

    expect(appError.message.length).toBeLessThan(300);
    expect(appError.message).toContain('…');
  });

  it('falls back to the generic message when there is nothing useful', () => {
    expect(toAppError(new Error(''), { provider: 'anthropic' }).message).toBe('The request failed. Please try again.');
  });

  it('surfaces the real cause behind a 200 that could not be parsed', () => {
    /**
     * The exact shape the live deployment produced: the provider answered
     * HTTP 200 but the body was not a valid stream (e.g. an error event
     * inside a 200 SSE). The AI SDK wraps it as "Failed to process successful
     * response" with the real reason in `cause`.
     */
    const cause = new Error('Unexpected end of JSON input');

    const error = Object.assign(new Error('Failed to process successful response'), {
      name: 'AI_APICallError',
      statusCode: 200,
      isRetryable: false,
      cause,
    });

    const appError = toAppError(error, { provider: 'openrouter', userManaged: true });

    /** It is a provider problem, and it names the real reason. */
    expect(appError.code).toBe(ERROR_CODES.PROVIDER_ERROR);
    expect(appError.message).not.toBe('The AI provider is currently unavailable. Please try again in a moment.');
    expect(appError.message).toContain('Unexpected end of JSON input');
  });

  it('skips generic wrapper messages to reach the specific cause', () => {
    const wrapper = Object.assign(new Error('Failed to process successful response'), {
      cause: new Error('The model returned an error event: no credits'),
    });

    expect(getUpstreamMessage(wrapper)).toBe('The model returned an error event: no credits');
  });
});

describe('user managed providers', () => {
  it('names the user key instead of a server environment variable on a 401', () => {
    const error = new APICallErrorStub(401, 'unauthorized');

    const appError = toAppError(error, { provider: 'openrouter', userManaged: true });

    expect(appError.code).toBe(ERROR_CODES.INVALID_API_KEY);
    expect(appError.message).toContain('your API key');
    expect(appError.message).not.toContain('OPENROUTER_API_KEY');
  });

  it('reports a model that does not belong to the configured provider', () => {
    const appError = toAppError(new ModelUnavailableError('The model "x" is not available.'), {
      provider: 'openrouter',
    });

    expect(appError.code).toBe(ERROR_CODES.MODEL_UNAVAILABLE);
    expect(appError.message).toContain('not available');
  });
});
