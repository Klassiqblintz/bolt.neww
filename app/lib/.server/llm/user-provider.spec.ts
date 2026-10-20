import { describe, expect, it } from 'vitest';
import { checkProviderUrl, normalizeBaseUrl } from '~/lib/.server/llm/url-policy';
import { redactSecrets, redactValue } from '~/lib/.server/llm/redact';
import { InvalidProviderError, resolveProvider, validateModelId } from '~/lib/.server/llm/user-provider';

describe('provider url policy', () => {
  it('accepts a public https endpoint', () => {
    expect(checkProviderUrl('https://openrouter.ai/api/v1').ok).toBe(true);
  });

  it('rejects http endpoints', () => {
    expect(checkProviderUrl('http://openrouter.ai/api/v1').ok).toBe(false);
  });

  it('allows http only when it is explicitly enabled', () => {
    expect(checkProviderUrl('http://localhost:1234/v1', true).ok).toBe(true);
    expect(checkProviderUrl('http://localhost:1234/v1', false).ok).toBe(false);
  });

  it('rejects local and internal hostnames', () => {
    for (const url of [
      'https://localhost/v1',
      'https://127.0.0.1/v1',
      'https://10.0.0.5/v1',
      'https://192.168.1.10/v1',
      'https://172.16.0.1/v1',
      'https://169.254.169.254/latest/meta-data',
      'https://metadata.google.internal/v1',
      'https://service.local/v1',
      'https://box.internal/v1',
    ]) {
      expect(checkProviderUrl(url).ok, url).toBe(false);
    }
  });

  it('rejects ipv6 loopback and link local addresses', () => {
    expect(checkProviderUrl('https://[::1]/v1').ok).toBe(false);
    expect(checkProviderUrl('https://[fe80::1]/v1').ok).toBe(false);
    expect(checkProviderUrl('https://[::ffff:127.0.0.1]/v1').ok).toBe(false);
  });

  it('rejects endpoints with credentials', () => {
    expect(checkProviderUrl('https://user:pass@example.com/v1').ok).toBe(false);
  });

  it('rejects an invalid url', () => {
    expect(checkProviderUrl('not a url').ok).toBe(false);
    expect(checkProviderUrl('').ok).toBe(false);
  });

  it('normalizes the trailing slash', () => {
    expect(normalizeBaseUrl('https://openrouter.ai/api/v1/')).toBe('https://openrouter.ai/api/v1');
  });
});

describe('model id validation', () => {
  it('accepts a normal model id', () => {
    expect(validateModelId('anthropic/claude-3.5-sonnet')).toBe('anthropic/claude-3.5-sonnet');
    expect(validateModelId('gpt-4o')).toBe('gpt-4o');
  });

  it('rejects an empty model id', () => {
    expect(() => validateModelId('')).toThrow(InvalidProviderError);
    expect(() => validateModelId(undefined)).toThrow(InvalidProviderError);
  });

  it('rejects control characters and injection attempts', () => {
    for (const value of ['model\nname', 'model name', 'model;rm -rf /', '<script>', 'a'.repeat(300)]) {
      expect(() => validateModelId(value), value).toThrow(InvalidProviderError);
    }
  });
});

describe('secret redaction', () => {
  it('removes anthropic keys', () => {
    expect(redactSecrets('key sk-ant-api03-abcdefghijklmnop')).not.toContain('sk-ant-api03');
  });

  it('removes openrouter keys', () => {
    expect(redactSecrets('key sk-or-v1-abcdefghijklmnop')).not.toContain('sk-or-v1-abcdefghijklmnop');
  });

  it('removes bearer tokens', () => {
    expect(redactSecrets('Authorization: Bearer abcdefghijklmnop')).not.toContain('abcdefghijklmnop');
  });

  it('removes keys that appear in an api key field', () => {
    expect(redactSecrets('{"apiKey":"supersecretvalue"}')).not.toContain('supersecretvalue');
  });

  it('redacts an error', () => {
    const error = new Error('failed with sk-ant-api03-abcdefghijklmnop');

    expect(redactValue(error)).not.toContain('sk-ant-api03');
  });

  it('redacts an object', () => {
    expect(redactValue({ apiKey: 'sk-ant-api03-abcdefghijklmnop' })).not.toContain('sk-ant-api03');
  });

  it('handles values that cannot be serialised', () => {
    const circular: Record<string, unknown> = {};

    circular.self = circular;

    expect(redactValue(circular)).toBe('[unserializable]');
  });
});

describe('provider resolution', () => {
  const env = {} as Env;

  it('falls back to the server provider when no spec is sent', () => {
    const resolved = resolveProvider({ env, serverModelId: 'claude-3-5-sonnet-20240620' });

    expect(resolved.source).toBe('server');
    expect(resolved.provider).toBe('anthropic');
  });

  it('uses the user provider when a spec is sent', () => {
    const resolved = resolveProvider({
      env,
      spec: { type: 'openrouter', modelId: 'openai/gpt-4o' },
      apiKey: 'sk-or-test',
    });

    expect(resolved.source).toBe('user');
    expect(resolved.provider).toBe('openrouter');
    expect(resolved.modelId).toBe('openai/gpt-4o');
  });

  it('rejects a user provider without an api key', () => {
    expect(() => resolveProvider({ env, spec: { type: 'openrouter', modelId: 'openai/gpt-4o' } })).toThrow(
      InvalidProviderError,
    );
  });

  it('rejects an unknown provider type', () => {
    expect(() =>
      resolveProvider({
        env,
        spec: { type: 'evil' as unknown as 'openrouter', modelId: 'openai/gpt-4o' },
        apiKey: 'sk-or-test',
      }),
    ).toThrow(InvalidProviderError);
  });

  it('rejects a private endpoint', () => {
    expect(() =>
      resolveProvider({
        env,
        spec: { type: 'openai-compatible', baseUrl: 'https://127.0.0.1/v1', modelId: 'gpt-4o' },
        apiKey: 'sk-test',
      }),
    ).toThrow(InvalidProviderError);
  });

  it('rejects a provider without a model', () => {
    expect(() =>
      resolveProvider({
        env,
        spec: { type: 'openrouter' },
        apiKey: 'sk-or-test',
      }),
    ).toThrow(InvalidProviderError);
  });
});
