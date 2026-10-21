import { describe, expect, it } from 'vitest';
import { parseProviderSpec } from './provider-spec';
import { InvalidProviderError } from './user-provider';

describe('parseProviderSpec', () => {
  it('returns undefined when the client sent no provider', () => {
    expect(parseProviderSpec(undefined)).toBeUndefined();
    expect(parseProviderSpec(null)).toBeUndefined();
  });

  it('reads a well formed provider', () => {
    expect(
      parseProviderSpec({ type: 'openai-compatible', baseUrl: 'https://api.example.com/v1', modelId: 'm1' }),
    ).toEqual({
      type: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      modelId: 'm1',
    });
  });

  it('drops values that are not part of the description', () => {
    expect(parseProviderSpec({ type: 'openrouter', apiKey: 'sk-or-v1-leaked', extra: true })).toEqual({
      type: 'openrouter',
      baseUrl: undefined,
      modelId: undefined,
    });
  });

  it('rejects an unsupported provider instead of falling back to the server provider', () => {
    expect(() => parseProviderSpec({ type: 'hologram', modelId: 'm1' })).toThrow(InvalidProviderError);
    expect(() => parseProviderSpec({ modelId: 'm1' })).toThrow(InvalidProviderError);
  });

  it('rejects a provider that is not an object', () => {
    expect(() => parseProviderSpec('openrouter')).toThrow(InvalidProviderError);
    expect(() => parseProviderSpec(42)).toThrow(InvalidProviderError);
  });

  it('keeps the endpoint and the model of a custom provider', () => {
    const spec = parseProviderSpec({
      type: 'openai-compatible',
      baseUrl: 'https://models.corp.example/v1',
      modelId: 'my-company/internal-model-v2',
    });

    expect(spec?.baseUrl).toBe('https://models.corp.example/v1');
    expect(spec?.modelId).toBe('my-company/internal-model-v2');
  });
});
