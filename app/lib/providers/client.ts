/**
 * The client side of the provider configuration.
 *
 * The API keys are decrypted into memory when the vault is read, so a request
 * can be signed with them. They are never written to the store, never
 * serialised and never logged.
 */

import { ProviderVault, type ProviderInput } from './storage.client';
import { PROVIDER_KEY_HEADER, type ProviderRequestSpec, type StoredProvider } from './types';
import { providersStore } from '~/lib/stores/providers';

const DEFAULT_PROVIDER_KEY = 'bolt_default_provider';

/**
 * The decrypted keys of this session. They only live in memory.
 */
const keyCache = new Map<string, string>();

let vault: ProviderVault | undefined;

function getVault(): ProviderVault {
  if (!vault) {
    vault = ProviderVault.create();
  }

  return vault;
}

function readDefaultProviderId(): string | undefined {
  try {
    return localStorage.getItem(DEFAULT_PROVIDER_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeDefaultProviderId(id: string | undefined): void {
  try {
    if (id) {
      localStorage.setItem(DEFAULT_PROVIDER_KEY, id);
    } else {
      localStorage.removeItem(DEFAULT_PROVIDER_KEY);
    }
  } catch {
    /**
     * The browser does not allow storage, the default provider is then only
     * kept for the session.
     */
  }
}

/**
 * Reads the vault and fills the store.
 */
export async function loadProviders(): Promise<StoredProvider[]> {
  let providers: StoredProvider[] = [];

  try {
    providers = await getVault().list();
  } catch (error) {
    /**
     * The vault can fail (e.g. private browsing). The store is still marked
     * loaded so the selection restore and the composer are never blocked by
     * a broken vault.
     */
    console.error('The provider vault could not be read', error);

    providersStore.set({ providers: [], defaultProviderId: undefined, loaded: true });

    return [];
  }

  keyCache.clear();

  for (const provider of providers) {
    try {
      const apiKey = await getVault().revealApiKey(provider.id);

      if (apiKey) {
        keyCache.set(provider.id, apiKey);
      }
    } catch (error) {
      console.error('A stored provider could not be decrypted', error);
    }
  }

  const storedDefaultId = readDefaultProviderId();

  const defaultProviderId = providers.some((provider) => provider.id === storedDefaultId)
    ? storedDefaultId
    : providers[0]?.id;

  if (defaultProviderId && defaultProviderId !== storedDefaultId) {
    writeDefaultProviderId(defaultProviderId);
  }

  providersStore.set({ providers, defaultProviderId, loaded: true });

  return providers;
}

export async function addProvider(input: ProviderInput): Promise<StoredProvider> {
  const provider = await getVault().add(input);

  keyCache.set(provider.id, input.apiKey);

  await loadProviders();

  return provider;
}

export async function updateProvider(
  id: string,
  changes: Partial<Omit<ProviderInput, 'apiKey'>> & { apiKey?: string },
): Promise<StoredProvider> {
  const provider = await getVault().update(id, changes);

  if (changes.apiKey) {
    keyCache.set(id, changes.apiKey);
  }

  await loadProviders();

  return provider;
}

export async function removeProvider(id: string): Promise<void> {
  await getVault().remove(id);

  keyCache.delete(id);

  const providers = await loadProviders();

  if (!providers.some((provider) => provider.id === readDefaultProviderId())) {
    writeDefaultProviderId(providers[0]?.id);
  }
}

export async function setDefaultProvider(id: string | undefined): Promise<void> {
  writeDefaultProviderId(id);

  await loadProviders();
}

/**
 * The provider that is used for new requests.
 */
export function getActiveProvider(): StoredProvider | undefined {
  const { providers, defaultProviderId } = providersStore.get();

  return providers.find((provider) => provider.id === defaultProviderId) ?? providers[0];
}

/**
 * The description of the active provider that is sent with a request.
 */
export function getProviderSpec(provider: StoredProvider | undefined): ProviderRequestSpec | undefined {
  if (!provider) {
    return undefined;
  }

  return {
    type: provider.type,
    baseUrl: provider.baseUrl,
    modelId: provider.modelId,
  };
}

/**
 * The API key of the active provider, taken from the in memory cache.
 */
export function getProviderApiKey(provider: StoredProvider | undefined): string | undefined {
  if (!provider) {
    return undefined;
  }

  return keyCache.get(provider.id);
}

/**
 * The headers that carry the API key of a user provider.
 */
export function getProviderHeaders(provider: StoredProvider | undefined): Record<string, string> {
  const apiKey = getProviderApiKey(provider);

  if (!apiKey) {
    return {};
  }

  return { [PROVIDER_KEY_HEADER]: apiKey };
}
