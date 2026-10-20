import { describe, expect, it } from 'vitest';
import { ERROR_CODES, formatError, parseError } from '~/lib/errors';
import { toAppError } from '~/lib/.server/llm/errors';

describe('error formatting', () => {
  it('round trips a code and a message', () => {
    const error = { code: ERROR_CODES.NOT_CONFIGURED, message: 'No key configured.' };

    expect(parseError(formatError(error))).toEqual(error);
  });

  it('falls back to a generic error for an empty body', () => {
    expect(parseError('')).toEqual({
      code: ERROR_CODES.UNKNOWN,
      message: 'The request failed. Please try again.',
    });
  });

  it('keeps an unformatted message instead of swallowing it', () => {
    expect(parseError('Something went wrong')).toEqual({
      code: ERROR_CODES.UNKNOWN,
      message: 'Something went wrong',
    });
  });

  it('does not treat an unknown code as a known one', () => {
    const parsed = parseError('[made_up_code] Message');

    expect(parsed.code).toBe(ERROR_CODES.UNKNOWN);

    // the raw body is preserved so that no information is lost
    expect(parsed.message).toBe('[made_up_code] Message');
  });
});

describe('upstream error mapping', () => {
  it('detects a missing API key', () => {
    const error = new Error('Anthropic API key is missing. Pass it using the apiKey parameter.');

    expect(toAppError(error).code).toBe(ERROR_CODES.NOT_CONFIGURED);
  });

  it('maps a rejected key', () => {
    expect(toAppError({ statusCode: 401 }).code).toBe(ERROR_CODES.INVALID_API_KEY);
  });

  it('maps an unavailable model', () => {
    expect(toAppError({ statusCode: 404 }).code).toBe(ERROR_CODES.MODEL_UNAVAILABLE);
  });

  it('maps rate limiting', () => {
    expect(toAppError({ statusCode: 429 }).code).toBe(ERROR_CODES.RATE_LIMITED);
  });

  it('maps provider outages', () => {
    expect(toAppError({ statusCode: 503 }).code).toBe(ERROR_CODES.PROVIDER_ERROR);
  });

  it('maps an invalid request', () => {
    expect(toAppError({ statusCode: 400 }).code).toBe(ERROR_CODES.INVALID_REQUEST);
  });

  it('falls back to unknown for unclassified errors', () => {
    expect(toAppError(new Error('boom')).code).toBe(ERROR_CODES.UNKNOWN);
  });

  it('never leaks the raw upstream error to the client', () => {
    const secret = 'sk-ant-api03-supersecret';

    const { message } = toAppError({ statusCode: 500, body: secret });

    expect(message).not.toContain(secret);
  });
});
