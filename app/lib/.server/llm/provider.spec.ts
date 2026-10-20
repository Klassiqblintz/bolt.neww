import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProviderConfig, getLanguageModel } from '~/lib/.server/llm/model';
import { getApiKeyEnvName, getProviderId, readEnvValue } from '~/lib/.server/llm/provider';
import { getAPIKey } from '~/lib/.server/llm/api-key';
import { getModelsForProvider } from '~/lib/models';

const ENV_KEYS = ['AI_PROVIDER', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'AI_MODELS', 'OPENROUTER_BASE_URL'];

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
});

const emptyEnv = {} as Env;

describe('provider selection', () => {
  it('defaults to anthropic so existing deployments keep working', () => {
    expect(getProviderId(emptyEnv)).toBe('anthropic');
  });

  it('selects openrouter when it is configured', () => {
    process.env.AI_PROVIDER = 'openrouter';

    expect(getProviderId(emptyEnv)).toBe('openrouter');
  });

  it('is case insensitive', () => {
    process.env.AI_PROVIDER = 'OpenRouter';

    expect(getProviderId(emptyEnv)).toBe('openrouter');
  });

  it('falls back to anthropic for an unknown provider', () => {
    process.env.AI_PROVIDER = 'not-a-provider';

    expect(getProviderId(emptyEnv)).toBe('anthropic');
  });

  it('reads the provider from the cloudflare bindings', () => {
    const env = { AI_PROVIDER: 'openrouter' } as unknown as Env;

    expect(getProviderId(env)).toBe('openrouter');
  });

  it('names the right environment variable per provider', () => {
    expect(getApiKeyEnvName('anthropic')).toBe('ANTHROPIC_API_KEY');
    expect(getApiKeyEnvName('openrouter')).toBe('OPENROUTER_API_KEY');
  });
});

describe('api key handling', () => {
  it('reads the key of the active provider', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-secret';

    expect(getAPIKey(emptyEnv, 'openrouter')).toBe('sk-or-secret');
  });

  it('does not use the key of the other provider', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-secret';

    expect(getAPIKey(emptyEnv, 'openrouter')).toBeUndefined();
  });

  it('ignores an empty value', () => {
    process.env.OPENROUTER_API_KEY = '   ';

    expect(getAPIKey(emptyEnv, 'openrouter')).toBeUndefined();
  });

  it('never returns the key in the provider configuration for the client', () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-secret';

    const config = getProviderConfig(emptyEnv);

    expect(config.apiKey).toBe('sk-or-secret');
    expect(JSON.stringify({ ...config, apiKey: undefined })).not.toContain('sk-or-secret');
  });
});

describe('environment reading', () => {
  it('prefers the process environment over the bindings', () => {
    process.env.AI_PROVIDER = 'openrouter';

    const env = { AI_PROVIDER: 'anthropic' } as unknown as Env;

    expect(readEnvValue('AI_PROVIDER', env)).toBe('openrouter');
  });

  it('returns undefined for an unset value', () => {
    expect(readEnvValue('AI_MODELS', emptyEnv)).toBeUndefined();
  });
});

describe('model catalogue', () => {
  it('offers the models of the configured provider only', () => {
    process.env.AI_PROVIDER = 'openrouter';

    const config = getProviderConfig(emptyEnv);

    expect(config.models.every((model) => model.provider === 'openrouter')).toBe(true);
    expect(config.models.length).toBe(getModelsForProvider('openrouter').length);
  });

  it('restricts the catalogue with AI_MODELS', () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.AI_MODELS = 'openai/gpt-4o, openai/gpt-4o-mini';

    const config = getProviderConfig(emptyEnv);

    expect(config.models.map((model) => model.id)).toEqual(['openai/gpt-4o', 'openai/gpt-4o-mini']);
  });

  it('uses a remaining model when the allow list removes the default', () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.AI_MODELS = 'openai/gpt-4o-mini';

    const config = getProviderConfig(emptyEnv);

    expect(config.defaultModelId).toBe('openai/gpt-4o-mini');
  });

  it('ignores an allow list that does not match any model', () => {
    process.env.AI_MODELS = 'some/unknown-model';

    const config = getProviderConfig(emptyEnv);

    expect(config.models).toHaveLength(0);
  });
});

describe('language model', () => {
  it('creates an anthropic model by default', () => {
    const model = getLanguageModel(emptyEnv);

    expect(model.modelId).toBe(getModelsForProvider('anthropic')[0].id);
    expect(model.provider).toBe('anthropic.messages');
  });

  it('creates an openai compatible model for openrouter', () => {
    process.env.AI_PROVIDER = 'openrouter';

    const model = getLanguageModel(emptyEnv);

    expect(model.modelId).toBe(getModelsForProvider('openrouter')[0].id);
    expect(model.provider).toBe('openai.chat');
  });

  it('uses the requested model when it belongs to the provider', () => {
    const model = getLanguageModel(emptyEnv, 'claude-3-opus-20240229');

    expect(model.modelId).toBe('claude-3-opus-20240229');
  });

  it('ignores a model of another provider', () => {
    process.env.AI_PROVIDER = 'openrouter';

    const model = getLanguageModel(emptyEnv, 'claude-3-opus-20240229');

    expect(model.modelId).not.toBe('claude-3-opus-20240229');
    expect(model.modelId.startsWith('anthropic/') || model.modelId.startsWith('openai/')).toBe(true);
  });

  it('falls back to the default for an unknown model', () => {
    const model = getLanguageModel(emptyEnv, 'made-up-model');

    expect(model.modelId).toBe(getModelsForProvider('anthropic')[0].id);
  });

  it('does not leak the key through the model', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-secret';

    const model = getLanguageModel(emptyEnv);

    expect(JSON.stringify(model)).not.toContain('sk-or-secret');
  });
});

describe('secret protection', () => {
  it('does not log or expose the key through an error', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-supersecret';

    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { toAppError } = await import('~/lib/.server/llm/errors');

    const error = toAppError(new Error('boom'), { provider: 'openrouter' });

    expect(error.message).not.toContain('sk-or-supersecret');
    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
