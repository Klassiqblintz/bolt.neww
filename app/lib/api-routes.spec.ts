import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { action as chatAction } from '~/routes/api.chat';
import { action as enhancerAction } from '~/routes/api.enhancer';
import { ERROR_CODES, parseError } from '~/lib/errors';

/**
 * These tests exercise the real route handlers without mocking the AI
 * provider, so they also cover the error mapping.
 */

const originalKey = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = originalKey;
  }
});

function chatRequest(body: unknown) {
  return new Request('https://example.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function enhancerRequest(body: unknown) {
  return new Request('https://example.com/api/enhancer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const context = { cloudflare: { env: {} } } as never;

describe('POST /api/chat', () => {
  it('reports a missing provider configuration instead of an empty error', async () => {
    const response = await chatAction({
      context,
      request: chatRequest({ messages: [{ role: 'user', content: 'hello' }] }),
      params: {},
    } as never);

    expect(response.status).toBe(503);

    const body = await response.text();

    expect(body.length).toBeGreaterThan(0);

    const { code, message } = parseError(body);

    expect(code).toBe(ERROR_CODES.NOT_CONFIGURED);
    expect(message).toContain('ANTHROPIC_API_KEY');
  });

  it('rejects a request without messages', async () => {
    const response = await chatAction({
      context,
      request: chatRequest({ messages: [] }),
      params: {},
    } as never);

    expect(response.status).toBe(400);

    const { code } = parseError(await response.text());

    expect(code).toBe(ERROR_CODES.INVALID_REQUEST);
  });

  it('passes the selected model on to the provider', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-test-key';

    let requestedBody = '';

    const fetchStub = vi.fn().mockImplementation(async (_url: unknown, init: { body?: string }) => {
      requestedBody = init.body ?? '';

      return new Response(
        'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[],"model":"claude-3-opus-20240229","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}}\n\ndata: {"type":"message_stop"}\n\n',
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
    });

    vi.stubGlobal('fetch', fetchStub);

    await chatAction({
      context,
      request: chatRequest({
        messages: [{ role: 'user', content: 'hello' }],
        modelId: 'claude-3-opus-20240229',
      }),
      params: {},
    } as never);

    expect(requestedBody).toContain('claude-3-opus-20240229');
    expect(requestedBody).not.toContain('claude-3-5-sonnet-20240620');

    vi.unstubAllGlobals();
  });

  it('never leaks the provider key in the error body', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-should-never-appear';

    // the provider is stubbed so the test does not depend on the network
    const fetchStub = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    vi.stubGlobal('fetch', fetchStub);

    const response = await chatAction({
      context,
      request: chatRequest({ messages: [{ role: 'user', content: 'hello' }] }),
      params: {},
    } as never);

    const body = await response.text();

    expect(body).not.toContain('sk-ant-api03-should-never-appear');
    expect(parseError(body).code).toBe(ERROR_CODES.INVALID_API_KEY);

    vi.unstubAllGlobals();
  });
});

describe('POST /api/enhancer', () => {
  it('reports a missing provider configuration instead of an empty error', async () => {
    const response = await enhancerAction({
      context,
      request: enhancerRequest({ message: 'make a todo app' }),
      params: {},
    } as never);

    expect(response.status).toBe(503);

    const body = await response.text();

    expect(body.length).toBeGreaterThan(0);
    expect(parseError(body).code).toBe(ERROR_CODES.NOT_CONFIGURED);
  });

  it('rejects an empty prompt', async () => {
    const response = await enhancerAction({
      context,
      request: enhancerRequest({ message: '   ' }),
      params: {},
    } as never);

    expect(response.status).toBe(400);
    expect(parseError(await response.text()).code).toBe(ERROR_CODES.INVALID_REQUEST);
  });
});
