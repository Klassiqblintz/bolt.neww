import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { action as chatAction } from '~/routes/api.chat';
import { action as enhancerAction } from '~/routes/api.enhancer';
import { loader as modelsLoader } from '~/routes/api.models';
import { loader as statusLoader } from '~/routes/api.status';
import { ERROR_CODES, parseError } from '~/lib/errors';
import { StreamingMessageParser } from '~/lib/runtime/message-parser';

/**
 * These tests exercise the real route handlers without mocking the AI
 * provider, so they also cover the error mapping.
 */

const ENV_KEYS = ['AI_PROVIDER', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'AI_MODELS'];

const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }

  vi.unstubAllGlobals();
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

/**
 * Decodes the text parts of an AI SDK stream.
 */
function decodeStreamText(stream: string): string {
  return stream
    .split('\n')
    .map((line) => line.match(/^\d+:"((?:[^"\\]|\\.)*)"$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => JSON.parse(`"${match[1]}"`) as string)
    .join('');
}

/**
 * A minimal OpenAI compatible streaming response.
 */
const OPENAI_STREAM = [
  'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"anthropic/claude-3.5-sonnet","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
  'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"anthropic/claude-3.5-sonnet","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
  'data: [DONE]',
  '',
].join('\n\n');

describe('user provider routing', () => {
  const OPENAI_ARTIFACT_STREAM = [
    'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"openai/gpt-4o","choices":[{"index":0,"delta":{"content":"<boltArtifact id=\\"demo\\" title=\\"Demo\\"><boltAction type=\\"file\\" filePath=\\"/home/project/index.html\\">hello</boltAction></boltArtifact>"},"finish_reason":null}]}',
    'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"openai/gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
    'data: [DONE]',
    '',
  ].join('\n\n');

  it('sends the request to the user provider', async () => {
    let requestedUrl = '';
    let requestedBody = '';
    let requestedHeaders: Record<string, string> = {};

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init: { body?: string; headers?: Record<string, string> }) => {
        requestedUrl = url;
        requestedBody = init.body ?? '';
        requestedHeaders = init.headers ?? {};

        return new Response(OPENAI_STREAM, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );

    const response = await chatAction({
      context,
      request: new Request('https://example.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bolt-provider-key': 'sk-or-user-key' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
          provider: { type: 'openrouter', modelId: 'openai/gpt-4o' },
        }),
      }),
      params: {},
    } as never);

    expect(response.status).toBe(200);
    expect(requestedUrl).toContain('openrouter.ai');
    expect(requestedBody).toContain('openai/gpt-4o');
    expect(JSON.stringify(requestedHeaders)).toContain('sk-or-user-key');
  });

  it('uses a custom endpoint of the user provider', async () => {
    let requestedUrl = '';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        requestedUrl = url;

        return new Response(OPENAI_STREAM, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );

    await chatAction({
      context,
      request: new Request('https://example.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bolt-provider-key': 'sk-user' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
          provider: { type: 'openai-compatible', baseUrl: 'https://api.example.com/v1', modelId: 'my-model' },
        }),
      }),
      params: {},
    } as never);

    expect(requestedUrl).toContain('https://api.example.com/v1');
  });

  it('rejects a private endpoint of the user provider', async () => {
    const response = await chatAction({
      context,
      request: new Request('https://example.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bolt-provider-key': 'sk-user' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
          provider: { type: 'openai-compatible', baseUrl: 'https://169.254.169.254/v1', modelId: 'my-model' },
        }),
      }),
      params: {},
    } as never);

    expect(response.status).toBe(400);

    const { message } = parseError(await response.text());

    expect(message).toContain('private network');
  });

  it('falls back to the server provider when no provider is sent', async () => {
    let requestedUrl = '';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        requestedUrl = url;

        return new Response(OPENAI_STREAM, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );

    process.env.ANTHROPIC_API_KEY = 'sk-ant-server-key';

    await chatAction({
      context,
      request: chatRequest({ messages: [{ role: 'user', content: 'hello' }] }),
      params: {},
    } as never);

    expect(requestedUrl).toContain('api.anthropic.com');
  });

  it('streams a response that the artifact parser understands', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(OPENAI_ARTIFACT_STREAM, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );

    const response = await chatAction({
      context,
      request: new Request('https://example.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bolt-provider-key': 'sk-or-user-key' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
          provider: { type: 'openrouter', modelId: 'openai/gpt-4o' },
        }),
      }),
      params: {},
    } as never);

    const text = await response.text();

    expect(text).toContain('<boltArtifact');

    /**
     * The artifact format has to stay the same, no matter which provider
     * produced it. The stream is in the AI SDK wire format, so the text parts
     * are decoded before they are parsed.
     */
    const parsed = decodeStreamText(text);

    expect(parsed).toContain('<boltArtifact');
    expect(parsed).toContain('<boltAction type="file"');

    const artifacts: string[] = [];
    const actions: Array<{ type: string; filePath?: string }> = [];

    const parser = new StreamingMessageParser({
      callbacks: {
        onArtifactOpen: (data) => artifacts.push(data.id),
        onActionClose: (data) => actions.push(data.action as { type: string; filePath?: string }),
      },
    });

    parser.parse('message-1', parsed);

    expect(artifacts).toEqual(['demo']);
    expect(actions[0].type).toBe('file');
    expect((actions[0] as { filePath?: string }).filePath).toBe('/home/project/index.html');
  });

  it('does not leak the user key in an error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'invalid key sk-or-user-key' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const response = await chatAction({
      context,
      request: new Request('https://example.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bolt-provider-key': 'sk-or-user-key' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
          provider: { type: 'openrouter', modelId: 'openai/gpt-4o' },
        }),
      }),
      params: {},
    } as never);

    const body = await response.text();

    expect(body).not.toContain('sk-or-user-key');
  });
});

describe('GET /api/models', () => {
  it('lists the models of the configured provider', async () => {
    const response = await modelsLoader({ context } as never);

    const data = (await response.json()) as { provider: string; models: Array<{ id: string }> };

    expect(data.provider).toBe('anthropic');
    expect(data.models.length).toBeGreaterThan(0);
    expect(data.models.every((model) => model.id.startsWith('claude'))).toBe(true);
  });

  it('lists the openrouter models when openrouter is configured', async () => {
    process.env.AI_PROVIDER = 'openrouter';

    const response = await modelsLoader({ context } as never);

    const data = (await response.json()) as { provider: string; models: Array<{ id: string }> };

    expect(data.provider).toBe('openrouter');
    expect(data.models.some((model) => model.id.includes('/'))).toBe(true);
  });

  it('never exposes a key', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-supersecret';

    const body = await (await modelsLoader({ context } as never)).text();

    expect(body).not.toContain('sk-ant-supersecret');
  });
});

describe('GET /api/status', () => {
  it('reports that the provider is not configured', async () => {
    const data = (await (await statusLoader({ context } as never)).json()) as {
      configured: boolean;
      provider: string;
      apiKeyEnvName: string;
    };

    expect(data.configured).toBe(false);
    expect(data.provider).toBe('anthropic');
    expect(data.apiKeyEnvName).toBe('ANTHROPIC_API_KEY');
  });

  it('names the openrouter variable when openrouter is configured', async () => {
    process.env.AI_PROVIDER = 'openrouter';

    const data = (await (await statusLoader({ context } as never)).json()) as {
      configured: boolean;
      apiKeyEnvName: string;
    };

    expect(data.configured).toBe(false);
    expect(data.apiKeyEnvName).toBe('OPENROUTER_API_KEY');
  });

  it('never exposes a key', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-supersecret';
    process.env.AI_PROVIDER = 'openrouter';

    const body = await (await statusLoader({ context } as never)).text();

    expect(body).not.toContain('sk-or-supersecret');
  });
});

describe('openrouter requests', () => {
  it('streams a response from the openai compatible endpoint', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    let requestedUrl = '';
    let requestedBody = '';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init: { body?: string; headers?: Record<string, string> }) => {
        requestedUrl = url;
        requestedBody = init.body ?? '';

        return new Response(OPENAI_STREAM, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );

    const response = await chatAction({
      context,
      request: chatRequest({
        messages: [{ role: 'user', content: 'hello' }],
        modelId: 'openai/gpt-4o',
      }),
      params: {},
    } as never);

    expect(response.status).toBe(200);
    expect(requestedUrl).toContain('openrouter.ai');
    expect(requestedBody).toContain('openai/gpt-4o');

    const text = await response.text();

    expect(text).toContain('Hello');
  });

  it('sends the openrouter key in the authorization header only', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    let requestedHeaders: Record<string, string> = {};

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init: { headers?: Record<string, string> }) => {
        requestedHeaders = init.headers ?? {};

        return new Response(OPENAI_STREAM, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );

    await chatAction({
      context,
      request: chatRequest({ messages: [{ role: 'user', content: 'hello' }] }),
      params: {},
    } as never);

    expect(JSON.stringify(requestedHeaders)).toContain('sk-or-test-key');
  });

  it('does not send the anthropic beta header to openrouter', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    let requestedHeaders: Record<string, string> = {};

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init: { headers?: Record<string, string> }) => {
        requestedHeaders = init.headers ?? {};

        return new Response(OPENAI_STREAM, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );

    await chatAction({
      context,
      request: chatRequest({ messages: [{ role: 'user', content: 'hello' }] }),
      params: {},
    } as never);

    expect(requestedHeaders['anthropic-beta']).toBeUndefined();
  });

  it('reports a missing openrouter key with the right variable name', async () => {
    process.env.AI_PROVIDER = 'openrouter';

    const response = await chatAction({
      context,
      request: chatRequest({ messages: [{ role: 'user', content: 'hello' }] }),
      params: {},
    } as never);

    expect(response.status).toBe(503);

    const { code, message } = parseError(await response.text());

    expect(code).toBe(ERROR_CODES.NOT_CONFIGURED);
    expect(message).toContain('OPENROUTER_API_KEY');
  });

  it('does not leak the openrouter key in an error response', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-supersecret';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'invalid key sk-or-supersecret' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const response = await chatAction({
      context,
      request: chatRequest({ messages: [{ role: 'user', content: 'hello' }] }),
      params: {},
    } as never);

    const body = await response.text();

    expect(body).not.toContain('sk-or-supersecret');
    expect(parseError(body).code).toBe(ERROR_CODES.INVALID_API_KEY);
  });

  it('enhances a prompt with the openrouter provider', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    let requestedBody = '';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init: { body?: string }) => {
        requestedBody = init.body ?? '';

        return new Response(OPENAI_STREAM, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );

    const response = await enhancerAction({
      context,
      request: enhancerRequest({ message: 'make a todo app', modelId: 'openai/gpt-4o' }),
      params: {},
    } as never);

    expect(response.status).toBe(200);
    expect(requestedBody).toContain('openai/gpt-4o');
  });
});

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
