import { describe, expect, it, vi } from 'vitest';
import {
  getDefaultModelId,
  getModelsForProvider,
  isValidModelId,
  PROVIDERS,
  PROVIDER_IDS,
  type ModelInfo,
  type ProviderId,
} from '~/lib/models';
import {
  BUILD_MODES,
  buildGenerationContext,
  buildModeStore,
  getBuildModeInstruction,
  initBuildMode,
  isBuildMode,
  PLANNING_INSTRUCTION,
  readPersistedBuildMode,
  writePersistedBuildMode,
  type BuildMode,
  type StorageLike,
} from '~/lib/stores/buildMode';

function createStorage(seed: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...seed };

  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('build modes', () => {
  it('offers exactly the four supported modes', () => {
    expect(BUILD_MODES.map((mode) => mode.id)).toEqual(['website', 'slides', 'app', 'prototype']);
  });

  it('gives every mode a label and an icon', () => {
    for (const mode of BUILD_MODES) {
      expect(mode.label).toBeTruthy();
      expect(mode.icon).toMatch(/^i-[a-z-]+:[a-z-]+$/);
    }
  });

  it('uses a distinct, stable icon for each mode', () => {
    const icons = BUILD_MODES.map((mode) => mode.icon);

    expect(new Set(icons).size).toBe(BUILD_MODES.length);
    expect(icons).toContain('i-ph:globe-hemisphere-west');
    expect(icons).toContain('i-ph:presentation-chart');
    expect(icons).toContain('i-ph:device-mobile');
    expect(icons).toContain('i-ph:flask');
  });

  it('can select each mode', () => {
    for (const mode of BUILD_MODES) {
      buildModeStore.set(mode.id);

      expect(buildModeStore.get()).toBe(mode.id);
    }
  });

  it('describes each mode differently so the model can act on it', () => {
    const instructions = BUILD_MODES.map((mode) => getBuildModeInstruction(mode.id));

    expect(new Set(instructions).size).toBe(BUILD_MODES.length);

    for (const instruction of instructions) {
      expect(instruction.length).toBeGreaterThan(20);
    }
  });
});

describe('build mode persistence', () => {
  it('restores a persisted mode (simulated reload)', () => {
    const storage = createStorage();

    writePersistedBuildMode('slides', storage);

    /** A fresh reader over the same data models a new page load. */
    expect(readPersistedBuildMode(createStorage({ ...storage.data }))).toBe('slides');
  });

  it('persists every supported mode', () => {
    for (const mode of BUILD_MODES) {
      const storage = createStorage();

      writePersistedBuildMode(mode.id, storage);

      expect(readPersistedBuildMode(storage)).toBe(mode.id);
    }
  });

  it('ignores an unknown or corrupted value instead of breaking the composer', () => {
    expect(readPersistedBuildMode(createStorage({ bolt_build_mode: 'hologram' }))).toBeUndefined();
    expect(readPersistedBuildMode(undefined)).toBeUndefined();
  });
});

describe('generation context', () => {
  it('includes the build mode instruction', () => {
    const context = buildGenerationContext('slides', false);

    expect(context).toBe(getBuildModeInstruction('slides'));
    expect(context).not.toContain(PLANNING_INSTRUCTION);
  });

  it('adds the planning instruction when planning mode is on', () => {
    const context = buildGenerationContext('website', true);

    expect(context).toContain(getBuildModeInstruction('website'));
    expect(context).toContain(PLANNING_INSTRUCTION);
  });

  it('never leaks the planning instruction when planning mode is off', () => {
    const context = buildGenerationContext('app', false);

    expect(context).not.toContain(PLANNING_INSTRUCTION);
  });
});

describe('build mode validation', () => {
  it('accepts every offered mode', () => {
    for (const mode of BUILD_MODES) {
      expect(isBuildMode(mode.id)).toBe(true);
    }
  });

  it('rejects anything that is not a known mode', () => {
    expect(isBuildMode('hologram')).toBe(false);
    expect(isBuildMode('')).toBe(false);
    expect(isBuildMode(undefined)).toBe(false);
    expect(isBuildMode(null)).toBe(false);
    expect(isBuildMode(42)).toBe(false);
  });
});

describe('build mode restoration', () => {
  it('does not read the persisted mode while the module is evaluated', async () => {
    const storage = createStorage({ bolt_build_mode: 'website' });
    const original = globalThis.localStorage;

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage,
    });

    try {
      vi.resetModules();

      const fresh = await import('~/lib/stores/buildMode');

      /**
       * The module is evaluated while the storage already holds a mode, but
       * the store still starts at the default. Reading the storage here would
       * make the server rendered markup and the hydrated markup disagree.
       */
      expect(fresh.buildModeStore.get()).toBe('app');

      fresh.initBuildMode();

      expect(fresh.buildModeStore.get()).toBe('website');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: original,
      });

      vi.resetModules();
    }
  });

  it('keeps the current mode when nothing was persisted', () => {
    const original = globalThis.localStorage;

    buildModeStore.set('slides');

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorage(),
    });

    try {
      initBuildMode();

      expect(buildModeStore.get()).toBe('slides');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: original,
      });
    }
  });
});

describe('model selection', () => {
  it('accepts every offered model of a provider', () => {
    for (const provider of PROVIDER_IDS) {
      for (const model of getModelsForProvider(provider)) {
        expect(isValidModelId(provider, model.id)).toBe(true);
      }
    }
  });

  it('rejects unknown models', () => {
    expect(isValidModelId('anthropic', 'not-a-model')).toBe(false);
    expect(isValidModelId('anthropic', '')).toBe(false);
    expect(isValidModelId('anthropic', undefined)).toBe(false);
  });

  it('does not accept a model of another provider', () => {
    const anthropicModel = getModelsForProvider('anthropic')[0];

    expect(isValidModelId('openrouter', anthropicModel.id)).toBe(false);
  });

  it('has a default model that is offered', () => {
    for (const provider of PROVIDER_IDS) {
      const defaultModelId = getDefaultModelId(provider);

      expect(getModelsForProvider(provider).some((model) => model.id === defaultModelId)).toBe(true);
    }
  });

  it('restricts the catalogue with an allow list', () => {
    const models = getModelsForProvider('openrouter', ['openai/gpt-4o']);

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('openai/gpt-4o');
  });

  it('only offers models that support streaming', () => {
    for (const provider of PROVIDER_IDS) {
      for (const model of getModelsForProvider(provider)) {
        expect(model.supportsStreaming).toBe(true);
      }
    }
  });

  it('marks the tool support of every model', () => {
    for (const provider of PROVIDER_IDS) {
      for (const model of getModelsForProvider(provider)) {
        expect(typeof model.supportsTools).toBe('boolean');
      }
    }
  });

  it('exposes a catalogue for every provider', () => {
    for (const provider of PROVIDER_IDS) {
      expect(PROVIDERS[provider].models.length).toBeGreaterThan(0);
      expect(PROVIDERS[provider].label).toBeTruthy();
    }
  });
});

describe('provider catalogue', () => {
  it('keeps the model ids of a provider unique', () => {
    for (const provider of PROVIDER_IDS) {
      const ids = getModelsForProvider(provider).map((model: ModelInfo) => model.id);

      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('associates every model with its provider', () => {
    for (const provider of PROVIDER_IDS) {
      for (const model of getModelsForProvider(provider)) {
        expect(model.provider).toBe(provider as ProviderId);
      }
    }
  });
});

describe('build mode instructions', () => {
  it('mentions the expected deliverable for each mode', () => {
    const expectations: Record<BuildMode, RegExp> = {
      website: /website/i,
      slides: /slide/i,
      app: /app/i,
      prototype: /prototype/i,
    };

    for (const mode of BUILD_MODES) {
      expect(getBuildModeInstruction(mode.id)).toMatch(expectations[mode.id]);
    }
  });
});
