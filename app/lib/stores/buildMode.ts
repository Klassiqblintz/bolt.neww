import { atom, map } from 'nanostores';

/**
 * Build modes shown on the homepage composer. The selected mode is injected
 * into the first user message so the model steers the generated artifact
 * towards that kind of deliverable.
 */
export type BuildMode = 'website' | 'slides' | 'app' | 'prototype';

export const BUILD_MODES: Array<{ id: BuildMode; label: string; icon: string }> = [
  { id: 'website', label: 'Website', icon: 'i-ph:globe-hemisphere-west' },
  { id: 'slides', label: 'Slides', icon: 'i-ph:presentation-chart' },
  { id: 'app', label: 'App', icon: 'i-ph:device-mobile' },
  { id: 'prototype', label: 'Prototype', icon: 'i-ph:flask' },
];

const BUILD_MODE_INSTRUCTIONS: Record<BuildMode, string> = {
  website:
    'The user wants to build a website. Focus on delivering a polished, responsive website with clean layout, typography and styling.',
  slides:
    'The user wants to build a slide deck. Deliver a presentation (e.g. reveal.js or an HTML slide viewer) with multiple slides, navigation and speaker-friendly content.',
  app: 'The user wants to build a full application. Focus on a working app with multiple features and a coherent user flow.',
  prototype:
    'The user wants a quick interactive prototype. Prioritize demonstrating the core idea and interactions over production polish or completeness.',
};

export function getBuildModeInstruction(mode: BuildMode): string {
  return BUILD_MODE_INSTRUCTIONS[mode];
}

const BUILD_MODE_STORAGE_KEY = 'bolt_build_mode';

/** The minimal storage surface, so the logic can be tested without a browser. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Reads the persisted build mode. Unknown or corrupted values are ignored, a
 * broken entry must never break the composer.
 */
export function readPersistedBuildMode(storage?: StorageLike): BuildMode | undefined {
  const target = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);

  if (!target) {
    return undefined;
  }

  try {
    const raw = target.getItem(BUILD_MODE_STORAGE_KEY);

    return BUILD_MODES.some((mode) => mode.id === raw) ? (raw as BuildMode) : undefined;
  } catch {
    return undefined;
  }
}

export function writePersistedBuildMode(mode: BuildMode, storage?: StorageLike): void {
  const target = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);

  if (!target) {
    return;
  }

  try {
    target.setItem(BUILD_MODE_STORAGE_KEY, mode);
  } catch {
    /**
     * The browser refuses storage (private mode, quota), the mode is then
     * only kept for the session.
     */
  }
}

/**
 * The build mode survives a reload, it is restored before the first message is
 * composed and it never interacts with the provider settings.
 */
export const buildModeStore = atom<BuildMode>(readPersistedBuildMode() ?? 'app');

/**
 * Picks a build mode and persists the choice.
 */
export function setBuildMode(mode: BuildMode): void {
  buildModeStore.set(mode);
  writePersistedBuildMode(mode);
}

export interface ChatOptions {
  /**
   * The model the client asked for. It is `undefined` until the server has
   * reported which models it serves, in which case the server uses its own
   * default.
   */
  modelId: string | undefined;
  planningMode: boolean;
}

/**
 * Homepage composer options. `modelId` is sent with each chat request and
 * validated server-side against the catalogue of the configured provider;
 * `planningMode` prepends a plan-first instruction to outgoing messages so the
 * assistant outlines an approach before coding.
 */
export const chatOptionsStore = map<ChatOptions>({
  modelId: undefined,
  planningMode: false,
});

export const PLANNING_INSTRUCTION =
  'Before writing any code, first outline a concise step-by-step plan for this request. Then continue with the implementation.';

/**
 * Builds the context that is prepended to the first message of a conversation.
 *
 * The selected build mode tells the model what kind of deliverable to create
 * and planning mode asks for a plan before any code is written.
 */
export function buildContextPrefix(mode: BuildMode, planningMode: boolean): string {
  const parts = [getBuildModeInstruction(mode)];

  if (planningMode) {
    parts.push(PLANNING_INSTRUCTION);
  }

  return parts.join('\n\n');
}
