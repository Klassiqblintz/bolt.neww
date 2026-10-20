import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chatOptionsStore } from '~/lib/stores/buildMode';
import { modelsStore } from '~/lib/stores/models';
import { providersStore } from '~/lib/stores/providers';
import {
  applyActiveProvider,
  getActiveProviderKey,
  MODEL_SELECTION_STORAGE_KEY,
  readPersistedSelection,
  restoreModelSelection,
  selectModel,
  writePersistedSelection,
  type StorageLike,
} from '~/lib/stores/selection';

/**
 * A localStorage stand-in, so the persistence logic is tested without a
 * browser. A fresh instance per test simulates a reload.
 */
function createStorage(seed: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...seed };

  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const USER_PROVIDER = {
  id: 'p1',
  type: 'openai-compatible' as const,
  name: 'My endpoint',
  baseUrl: 'https://api.example.com/v1',
  encryptedKey: 'enc',
  keySalt: 'salt',
  keyIv: 'iv',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function useServerProvider(provider: 'anthropic' | 'openrouter') {
  providersStore.set({ providers: [], defaultProviderId: undefined, loaded: true });
  modelsStore.set({ provider, models: [], defaultModelId: undefined, loaded: true });
}

function useUserProvider() {
  providersStore.set({ providers: [USER_PROVIDER], defaultProviderId: USER_PROVIDER.id, loaded: true });
  modelsStore.set({ provider: 'anthropic', models: [], defaultModelId: undefined, loaded: true });
}

beforeEach(() => {
  chatOptionsStore.setKey('modelId', undefined);
});

afterEach(() => {
  providersStore.set({ providers: [], defaultProviderId: undefined, loaded: false });
  modelsStore.set({ provider: undefined, models: [], defaultModelId: undefined, loaded: false });
});

describe('persisted selection format', () => {
  it('stores the model together with its provider', () => {
    const storage = createStorage();

    writePersistedSelection({ providerKey: 'server:openrouter', modelId: 'openai/gpt-4o' }, storage);

    const raw = JSON.parse(storage.data[MODEL_SELECTION_STORAGE_KEY]) as { providerKey: string; modelId: string };

    expect(raw.providerKey).toBe('server:openrouter');
    expect(raw.modelId).toBe('openai/gpt-4o');
  });

  it('never stores anything that looks like a credential', () => {
    const storage = createStorage();

    writePersistedSelection({ providerKey: 'user:p1:openai-compatible', modelId: 'my-model' }, storage);

    expect(storage.data[MODEL_SELECTION_STORAGE_KEY]).not.toContain('sk-');
    expect(storage.data[MODEL_SELECTION_STORAGE_KEY]).not.toContain('apiKey');
  });

  it('restores what was written (simulated reload)', () => {
    const storage = createStorage();

    writePersistedSelection({ providerKey: 'user:p1:openai-compatible', modelId: 'my-model' }, storage);

    /**
     * A new storage reader over the same data models a fresh page load: the
     * in memory stores are empty again, only localStorage survives.
     */
    expect(readPersistedSelection(createStorage({ ...storage.data }))).toEqual({
      providerKey: 'user:p1:openai-compatible',
      modelId: 'my-model',
    });
  });

  it('ignores corrupted or foreign data instead of throwing', () => {
    expect(readPersistedSelection(createStorage({ [MODEL_SELECTION_STORAGE_KEY]: '{broken' }))).toBeUndefined();
    expect(readPersistedSelection(createStorage({ [MODEL_SELECTION_STORAGE_KEY]: '{"modelId":5}' }))).toBeUndefined();
    expect(readPersistedSelection(createStorage({ [MODEL_SELECTION_STORAGE_KEY]: '[]' }))).toBeUndefined();
    expect(readPersistedSelection(undefined)).toBeUndefined();
  });

  it('clears the entry when the selection is removed', () => {
    const storage = createStorage({
      [MODEL_SELECTION_STORAGE_KEY]: '{"providerKey":"server:anthropic","modelId":"x"}',
    });

    writePersistedSelection(undefined, storage);

    expect(storage.data[MODEL_SELECTION_STORAGE_KEY]).toBeUndefined();
  });
});

describe('provider keys', () => {
  it('reports the server provider once the catalogue is loaded', () => {
    useServerProvider('openrouter');

    expect(getActiveProviderKey()).toBe('server:openrouter');
  });

  it('reports a user provider by record id and type', () => {
    useUserProvider();

    expect(getActiveProviderKey()).toBe(`user:${USER_PROVIDER.id}:openai-compatible`);
  });

  it('stays unknown before the vault has been read', () => {
    providersStore.set({ providers: [], defaultProviderId: undefined, loaded: false });
    modelsStore.set({ provider: 'anthropic', models: [], defaultModelId: undefined, loaded: true });

    expect(getActiveProviderKey()).toBeUndefined();
  });
});

describe('selecting a model', () => {
  it('persists the choice with the active provider', () => {
    const storage = createStorage();
    useServerProvider('openrouter');

    const original = globalThis.localStorage;

    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

    try {
      selectModel('openai/gpt-4o');

      expect(chatOptionsStore.get().modelId).toBe('openai/gpt-4o');
      expect(readPersistedSelection(storage)).toEqual({ providerKey: 'server:openrouter', modelId: 'openai/gpt-4o' });
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
    }
  });
});

describe('restoring the selection', () => {
  it('applies a saved model for the same server provider', () => {
    useServerProvider('openrouter');

    const result = restoreModelSelectionWith({
      [MODEL_SELECTION_STORAGE_KEY]: JSON.stringify({ providerKey: 'server:openrouter', modelId: 'openai/gpt-4o' }),
    });

    expect(result).toEqual({ applied: true });
    expect(chatOptionsStore.get().modelId).toBe('openai/gpt-4o');
  });

  it('never applies a model that belongs to another provider', () => {
    useServerProvider('anthropic');

    const result = restoreModelSelectionWith({
      [MODEL_SELECTION_STORAGE_KEY]: JSON.stringify({ providerKey: 'server:openrouter', modelId: 'openai/gpt-4o' }),
    });

    expect(result.applied).toBe(false);
    expect(chatOptionsStore.get().modelId).toBeUndefined();
  });

  it('applies a saved model for the same user provider', () => {
    useUserProvider();

    const result = restoreModelSelectionWith({
      [MODEL_SELECTION_STORAGE_KEY]: JSON.stringify({
        providerKey: `user:${USER_PROVIDER.id}:openai-compatible`,
        modelId: 'my-custom-model',
      }),
    });

    expect(result).toEqual({ applied: true });
    expect(chatOptionsStore.get().modelId).toBe('my-custom-model');
  });

  it('does not apply a saved model of a removed user provider', () => {
    useServerProvider('anthropic');

    const result = restoreModelSelectionWith({
      [MODEL_SELECTION_STORAGE_KEY]: JSON.stringify({
        providerKey: 'user:deleted:openai-compatible',
        modelId: 'my-custom-model',
      }),
    });

    expect(result.applied).toBe(false);
    expect(chatOptionsStore.get().modelId).toBeUndefined();
  });

  it('reports a saved server model that left the catalogue instead of replacing it', () => {
    useServerProvider('openrouter');

    const result = restoreModelSelectionWith({
      [MODEL_SELECTION_STORAGE_KEY]: JSON.stringify({
        providerKey: 'server:openrouter',
        modelId: 'openai/model-that-was-retired',
      }),
    });

    /**
     * The model is still selected so the user sees what was saved, and it is
     * flagged instead of being silently swapped for an unrelated default.
     */
    expect(result).toEqual({ applied: true, unavailableModelId: 'openai/model-that-was-retired' });
    expect(chatOptionsStore.get().modelId).toBe('openai/model-that-was-retired');
  });

  it('does nothing when nothing was saved', () => {
    useServerProvider('anthropic');

    const result = restoreModelSelectionWith({});

    expect(result).toEqual({ applied: false, reason: 'no-saved-selection' });
    expect(chatOptionsStore.get().modelId).toBeUndefined();
  });

  it('keeps an explicit selection that was made before the restore', () => {
    useServerProvider('openrouter');
    chatOptionsStore.setKey('modelId', 'openai/gpt-4o-mini');

    const result = restoreModelSelectionWith({
      [MODEL_SELECTION_STORAGE_KEY]: JSON.stringify({ providerKey: 'server:openrouter', modelId: 'openai/gpt-4o' }),
    });

    expect(result).toEqual({ applied: false, reason: 'already-selected' });
    expect(chatOptionsStore.get().modelId).toBe('openai/gpt-4o-mini');
  });
});

describe('provider switching', () => {
  it('never keeps the model of the previous provider (cross-provider mismatch)', () => {
    /**
     * The selection was saved for the openrouter server provider and the
     * model was picked, then the active provider changes to anthropic at
     * runtime. The openrouter model must not be sent to anthropic.
     */
    const storage = createStorage({
      [MODEL_SELECTION_STORAGE_KEY]: JSON.stringify({ providerKey: 'server:openrouter', modelId: 'openai/gpt-4o' }),
    });

    const original = globalThis.localStorage;

    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

    try {
      useServerProvider('openrouter');
      chatOptionsStore.setKey('modelId', 'openai/gpt-4o');

      const previousKey = getActiveProviderKey();

      /** Simulates the runtime switch to the anthropic provider. */
      useServerProvider('anthropic');

      applyActiveProvider(previousKey);

      /** The old model is gone from the request state... */
      expect(chatOptionsStore.get().modelId).toBeUndefined();

      /** ...while the saved entry survives, so switching back restores it. */
      expect(readPersistedSelection(storage)?.modelId).toBe('openai/gpt-4o');

      const keyNow = getActiveProviderKey();

      useServerProvider('openrouter');

      applyActiveProvider(keyNow);

      expect(chatOptionsStore.get().modelId).toBe('openai/gpt-4o');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
    }
  });

  it('does not touch the selection when the provider did not change', () => {
    useServerProvider('anthropic');
    chatOptionsStore.setKey('modelId', 'claude-3-opus-20240229');

    applyActiveProvider('server:anthropic');

    expect(chatOptionsStore.get().modelId).toBe('claude-3-opus-20240229');
  });
});

/**
 * Runs restoreModelSelection with a controlled localStorage. The in memory
 * selection is reset by the surrounding beforeEach, only the storage is
 * seeded here.
 */
function restoreModelSelectionWith(seed: Record<string, string>) {
  const storage = createStorage(seed);
  const original = globalThis.localStorage;

  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

  try {
    return restoreModelSelection();
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
  }
}
