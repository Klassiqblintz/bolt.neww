import { afterEach, describe, expect, it, vi } from 'vitest';
import { openrouterAdapter } from '~/lib/.server/llm/adapters/openrouter';
import { openaiCompatibleAdapter } from '~/lib/.server/llm/adapters/openai-compatible';
import { anthropicAdapter } from '~/lib/.server/llm/adapters/anthropic';
import { action as modelsAction } from '~/routes/api.providers.models';
import { PROVIDER_KEY_HEADER } from '~/lib/providers/types';

const context = { cloudflare: { env: {} } } as never;

function modelsRequest(provider: unknown, apiKey?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (apiKey) {
    headers[PROVIDER_KEY_HEADER] = apiKey;
  }

  return new Request('https://example.com/api/providers/models', {
    method: 'POST',
    headers,
    body: JSON.stringify({ provider }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('model discovery', () => {
  it('marks a model as free only when the provider reports a price of zero', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              { id: 'free/model', name: 'Free model', pricing: { prompt: '0', completion: '0' } },
              { id: 'paid/model', name: 'Paid model', pricing: { prompt: '0.000003', completion: '0.000015' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const response = await modelsAction({
      context,
      request: modelsRequest({ type: 'openrouter' }, 'sk-or-test'),
      params: {},
    } as never);

    const data = (await response.json()) as { models: Array<{ id: string; isFree: boolean }> };

    expect(data.models.find((model) => model.id === 'free/model')?.isFree).toBe(true);
    expect(data.models.find((model) => model.id === 'paid/model')?.isFree).toBe(false);
  });

  it('does not mark a model as free when the provider does not report pricing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: 'openai/gpt-4o', name: 'GPT-4o' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const response = await modelsAction({
      context,
      request: modelsRequest({ type: 'openrouter' }, 'sk-or-test'),
      params: {},
    } as never);

    const data = (await response.json()) as { models: Array<{ id: string; isFree: boolean }> };

    expect(data.models[0].isFree).toBe(false);
  });

  it('never infers the free state from the model name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              { id: 'vendor/free-thing', name: 'free-thing', pricing: { prompt: '0.001', completion: '0.002' } },
              { id: 'vendor/paid-thing', name: 'paid-thing', pricing: { prompt: '0', completion: '0' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const response = await modelsAction({
      context,
      request: modelsRequest({ type: 'openrouter' }, 'sk-or-test'),
      params: {},
    } as never);

    const data = (await response.json()) as { models: Array<{ id: string; isFree: boolean }> };

    expect(data.models.find((model) => model.id === 'vendor/free-thing')?.isFree).toBe(false);
    expect(data.models.find((model) => model.id === 'vendor/paid-thing')?.isFree).toBe(true);
  });

  it('reports the context length and the tool support of a model', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'openai/gpt-4o',
                name: 'GPT-4o',
                context_length: 128000,
                supported_parameters: ['tools', 'temperature'],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const response = await modelsAction({
      context,
      request: modelsRequest({ type: 'openrouter' }, 'sk-or-test'),
      params: {},
    } as never);

    const data = (await response.json()) as {
      models: Array<{ contextLength?: number; supportsTools?: boolean }>;
    };

    expect(data.models[0].contextLength).toBe(128000);
    expect(data.models[0].supportsTools).toBe(true);
  });

  it('reports an invalid key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {} }), { status: 401 })));

    const response = await modelsAction({
      context,
      request: modelsRequest({ type: 'openrouter' }, 'sk-or-wrong'),
      params: {},
    } as never);

    const data = (await response.json()) as { error: { message: string } };

    expect(response.status).toBe(401);
    expect(data.error.message).toContain('API key');
  });

  it('reports a missing key', async () => {
    const response = await modelsAction({
      context,
      request: modelsRequest({ type: 'openrouter' }),
      params: {},
    } as never);

    expect(response.status).toBe(503);
  });

  it('rejects a private endpoint', async () => {
    const response = await modelsAction({
      context,
      request: modelsRequest({ type: 'openai-compatible', baseUrl: 'https://127.0.0.1/v1' }, 'sk-test'),
      params: {},
    } as never);

    expect(response.status).toBe(400);
  });

  it('never echoes the api key back', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { message: 'invalid key sk-or-supersecret' } }), { status: 401 }),
        ),
    );

    const response = await modelsAction({
      context,
      request: modelsRequest({ type: 'openrouter' }, 'sk-or-supersecret'),
      params: {},
    } as never);

    const body = await response.text();

    expect(body).not.toContain('sk-or-supersecret');
  });
});

describe('provider adapters', () => {
  it('uses the anthropic models endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'claude-3-5-sonnet-20240620', display_name: 'Claude 3.5' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const models = await anthropicAdapter.listModels!(
      { type: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
      'sk-ant-test',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/models',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'sk-ant-test' }) }),
    );

    expect(models[0].label).toBe('Claude 3.5');
    expect(models[0].isFree).toBe(false);
  });

  it('uses the openrouter models endpoint with a bearer token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );

    vi.stubGlobal('fetch', fetchMock);

    await openrouterAdapter.listModels!({ type: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' }, 'sk-or-test');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer sk-or-test' }) }),
    );
  });

  it('uses the openai compatible models endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'local-model' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const models = await openaiCompatibleAdapter.listModels!(
      { type: 'openai-compatible', baseUrl: 'https://api.example.com/v1' },
      'sk-test',
    );

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/v1/models', expect.anything());
    expect(models[0].id).toBe('local-model');
  });

  it('reports an empty catalogue as an empty list', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
        ),
    );

    const response = await modelsAction({
      context,
      request: modelsRequest({ type: 'openrouter' }, 'sk-or-test'),
      params: {},
    } as never);

    const data = (await response.json()) as { models: unknown[] };

    expect(data.models).toEqual([]);
  });
});
