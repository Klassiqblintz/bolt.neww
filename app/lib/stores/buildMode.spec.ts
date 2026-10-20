import { describe, expect, it } from 'vitest';
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID, isValidModelId } from '~/lib/models';
import {
  BUILD_MODES,
  buildContextPrefix,
  buildModeStore,
  getBuildModeInstruction,
  PLANNING_INSTRUCTION,
  type BuildMode,
} from '~/lib/stores/buildMode';

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

describe('context prefix', () => {
  it('includes the build mode instruction', () => {
    const prefix = buildContextPrefix('slides', false);

    expect(prefix).toBe(getBuildModeInstruction('slides'));
    expect(prefix).not.toContain(PLANNING_INSTRUCTION);
  });

  it('adds the planning instruction when planning mode is on', () => {
    const prefix = buildContextPrefix('website', true);

    expect(prefix).toContain(getBuildModeInstruction('website'));
    expect(prefix).toContain(PLANNING_INSTRUCTION);
  });

  it('never leaks the planning instruction when planning mode is off', () => {
    const prefix = buildContextPrefix('app', false);

    expect(prefix).not.toContain(PLANNING_INSTRUCTION);
  });
});

describe('model selection', () => {
  it('accepts every offered model', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(isValidModelId(model.id)).toBe(true);
    }
  });

  it('rejects unknown models', () => {
    expect(isValidModelId('not-a-model')).toBe(false);
    expect(isValidModelId('')).toBe(false);
    expect(isValidModelId(undefined)).toBe(false);
  });

  it('has a default model that is offered', () => {
    expect(AVAILABLE_MODELS.some((model) => model.id === DEFAULT_MODEL_ID)).toBe(true);
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
