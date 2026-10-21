import { atom, map } from 'nanostores';
import {
  BUILD_MODES,
  buildGenerationContext,
  DEFAULT_BUILD_MODE,
  getBuildModeInstruction,
  isBuildMode,
  PLANNING_INSTRUCTION,
  type BuildMode,
} from '~/lib/buildModes';
import { getLocalStorage, type StorageLike } from '~/lib/storage';

export {
  BUILD_MODES,
  buildGenerationContext,
  DEFAULT_BUILD_MODE,
  getBuildModeInstruction,
  isBuildMode,
  PLANNING_INSTRUCTION,
  type BuildMode,
};

const BUILD_MODE_STORAGE_KEY = 'bolt_build_mode';

export type { StorageLike };

/**
 * Reads the persisted build mode. Unknown or corrupted values are ignored, a
 * broken entry must never break the composer.
 */
export function readPersistedBuildMode(storage: StorageLike | undefined = getLocalStorage()): BuildMode | undefined {
  if (!storage) {
    return undefined;
  }

  try {
    const raw = storage.getItem(BUILD_MODE_STORAGE_KEY);

    return isBuildMode(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function writePersistedBuildMode(mode: BuildMode, storage: StorageLike | undefined = getLocalStorage()): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(BUILD_MODE_STORAGE_KEY, mode);
  } catch {
    /**
     * The browser refuses storage (private mode, quota), the mode is then
     * only kept for the session.
     */
  }
}

/**
 * The selected build mode.
 *
 * The store starts with a constant default on purpose. Reading the persisted
 * value while the module is evaluated would make the first render of the
 * server rendered markup differ from the first render in the browser, because
 * the server has no access to `localStorage`. The persisted value is restored
 * by `initBuildMode` once the client is running.
 */
export const buildModeStore = atom<BuildMode>(DEFAULT_BUILD_MODE);

/**
 * Restores the persisted build mode.
 *
 * This runs in the browser only, after the first render, so the server
 * rendered markup and the hydrated markup agree.
 */
export function initBuildMode(): void {
  const persisted = readPersistedBuildMode();

  if (persisted) {
    buildModeStore.set(persisted);
  }
}

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
 * `planningMode` asks the assistant to outline a plan before any code is
 * written.
 */
export const chatOptionsStore = map<ChatOptions>({
  modelId: undefined,
  planningMode: false,
});
