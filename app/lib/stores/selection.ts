import { isValidModelId, type ProviderId } from '~/lib/models';
import { chatOptionsStore } from '~/lib/stores/buildMode';
import { modelsStore } from '~/lib/stores/models';
import { providersStore } from '~/lib/stores/providers';

/**
 * Persistence of the model selection, scoped to the provider it belongs to.
 *
 * The app has no accounts, so the selection lives in a clearly scoped
 * localStorage entry (`bolt_model_selection`). It stores the model id
 * *together with* the provider it was picked for, so a model can never be
 * replayed against a different provider after a reload or a provider switch.
 * API keys are never part of this entry, credentials only ever live in the
 * encrypted vault.
 */

export const MODEL_SELECTION_STORAGE_KEY = 'bolt_model_selection';

export interface PersistedModelSelection {
  /** The provider the model belongs to, e.g. `server:openrouter` or `user:p1:openai-compatible`. */
  providerKey: string;
  modelId: string;
}

/** The minimal storage surface, so the logic can be tested without a browser. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Reads the persisted selection. Corrupted or foreign data is ignored instead
 * of throwing, a broken entry must never break the composer.
 */
export function readPersistedSelection(
  storage: StorageLike | undefined = defaultStorage(),
): PersistedModelSelection | undefined {
  if (!storage) {
    return undefined;
  }

  try {
    const raw = storage.getItem(MODEL_SELECTION_STORAGE_KEY);

    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedModelSelection> | null;

    if (!parsed || typeof parsed.providerKey !== 'string' || typeof parsed.modelId !== 'string') {
      return undefined;
    }

    const providerKey = parsed.providerKey.trim();
    const modelId = parsed.modelId.trim();

    if (!providerKey || !modelId) {
      return undefined;
    }

    return { providerKey, modelId };
  } catch {
    return undefined;
  }
}

export function writePersistedSelection(
  selection: PersistedModelSelection | undefined,
  storage: StorageLike | undefined = defaultStorage(),
): void {
  if (!storage) {
    return;
  }

  try {
    if (!selection) {
      storage.removeItem(MODEL_SELECTION_STORAGE_KEY);

      return;
    }

    storage.setItem(MODEL_SELECTION_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    /**
     * The browser refuses storage (private mode, quota). The selection is then
     * only kept for the session.
     */
  }
}

/**
 * Identifies the provider that is currently used for requests.
 *
 * User providers are identified by their record id and type, the server
 * fallback by its configured provider id. The key is what ties a persisted
 * model to the provider it belongs to.
 */
export function getActiveProviderKey(): string | undefined {
  const { providers, defaultProviderId, loaded } = providersStore.get();
  const userProvider = providers.find((provider) => provider.id === defaultProviderId) ?? providers[0];

  if (userProvider) {
    return `user:${userProvider.id}:${userProvider.type}`;
  }

  /**
   * Before the vault has been read there may still be a user provider, so the
   * server key is only reported once the vault confirmed there is none.
   */
  if (!loaded) {
    return undefined;
  }

  const { provider } = modelsStore.get();

  return `server:${provider ?? 'default'}`;
}

/**
 * A user action picked a model. The choice is stored together with the
 * provider it belongs to.
 */
export function selectModel(modelId: string | undefined): void {
  chatOptionsStore.setKey('modelId', modelId);

  const providerKey = getActiveProviderKey();

  if (modelId && providerKey) {
    writePersistedSelection({ providerKey, modelId });
  } else {
    writePersistedSelection(undefined);
  }
}

export interface RestoreResult {
  /** Whether the saved selection was applied. */
  applied: boolean;

  /** The saved model when it could not be applied for the active provider. */
  unavailableModelId?: string;

  reason?: 'no-saved-selection' | 'provider-changed' | 'already-selected';
}

/**
 * Applies the saved selection for the active provider.
 *
 * A saved model of a *different* provider is never applied and never sent, it
 * is only kept in storage so switching back restores it. A saved model that
 * is not part of the catalogue of a built-in provider is reported as
 * unavailable instead of being silently replaced by an unrelated default.
 */
export function restoreModelSelection(): RestoreResult {
  const saved = readPersistedSelection();

  if (!saved) {
    return { applied: false, reason: 'no-saved-selection' };
  }

  const providerKey = getActiveProviderKey();

  if (!providerKey || providerKey !== saved.providerKey) {
    return { applied: false, reason: 'provider-changed' };
  }

  if (chatOptionsStore.get().modelId) {
    return { applied: false, reason: 'already-selected' };
  }

  chatOptionsStore.setKey('modelId', saved.modelId);

  const serverProvider = getServerProviderIfActive(providerKey);

  if (serverProvider && !isValidModelId(serverProvider, saved.modelId)) {
    return { applied: true, unavailableModelId: saved.modelId };
  }

  return { applied: true };
}

function getServerProviderIfActive(providerKey: string): ProviderId | undefined {
  if (!providerKey.startsWith('server:')) {
    return undefined;
  }

  const { provider } = modelsStore.get();

  return provider;
}

let initialized = false;
let lastProviderKey: string | undefined;

/** How long a prompt may wait for the saved selection before it is sent anyway. */
const SELECTION_READY_TIMEOUT_MS = 3000;

let readyResolve: () => void = () => undefined;

/**
 * Resolves once the catalogue and the vault have been read and the saved
 * selection has been considered, so a request never leaves the composer with
 * a stale or empty selection while the real one is still loading.
 *
 * A timeout makes sure a hanging catalogue fetch can never block sending a
 * message; the server then falls back to its own default.
 */
const readyPromise = new Promise<void>((resolve) => {
  readyResolve = resolve;

  if (typeof window !== 'undefined') {
    window.setTimeout(resolve, SELECTION_READY_TIMEOUT_MS);
  }
});

export function whenSelectionReady(): Promise<void> {
  return readyPromise;
}

function considerRestore(): void {
  const result = restoreModelSelection();

  if (result.unavailableModelId) {
    modelsStore.setKey('unavailableModelId', result.unavailableModelId);
  }
}

function checkReady(): void {
  const { loaded: modelsLoaded } = modelsStore.get();
  const { loaded: providersLoaded } = providersStore.get();

  if (modelsLoaded && providersLoaded) {
    considerRestore();
    readyResolve();
  }
}

/**
 * Applies the consequences of an active provider change: a saved model of the
 * new provider is restored, otherwise the selection is cleared so the model of
 * the previous provider can never be sent to the new one.
 *
 * `previousKey` is the provider key before the change, `undefined` for the
 * first call at startup.
 */
export function applyActiveProvider(previousKey: string | undefined): void {
  const key = getActiveProviderKey();

  if (!key || key === previousKey) {
    return;
  }

  const saved = readPersistedSelection();

  if (saved && saved.providerKey === key) {
    chatOptionsStore.setKey('modelId', saved.modelId);

    const serverProvider = getServerProviderIfActive(key);

    modelsStore.setKey(
      'unavailableModelId',
      serverProvider && !isValidModelId(serverProvider, saved.modelId) ? saved.modelId : undefined,
    );

    return;
  }

  /**
   * The new provider has no saved model: the previous provider's model must
   * not be sent to it, so the selection is cleared and the provider default
   * applies.
   */
  chatOptionsStore.setKey('modelId', undefined);
  modelsStore.setKey('unavailableModelId', undefined);
}

/**
 * Watches the active provider so a runtime switch never keeps the model of
 * the previous provider, and so switching back restores the saved one.
 */
function onProvidersChanged(): void {
  const key = getActiveProviderKey();

  if (!key || key === lastProviderKey) {
    return;
  }

  const previousKey = lastProviderKey;

  lastProviderKey = key;

  if (!providersStore.get().loaded || !modelsStore.get().loaded) {
    return;
  }

  applyActiveProvider(previousKey);
}

/**
 * Starts the persistence wiring. Safe to call more than once and safe on the
 * server, where none of the browser APIs exist.
 */
export function initSelectionPersistence(): void {
  if (initialized || typeof window === 'undefined') {
    return;
  }

  initialized = true;

  modelsStore.subscribe(checkReady);
  providersStore.subscribe(checkReady);
  providersStore.subscribe(onProvidersChanged);

  /**
   * The stores may already be loaded when this module is first imported on a
   * restored session, so the check runs once directly as well.
   */
  checkReady();
}
