/**
 * The vault that holds the user configured providers.
 *
 * The credentials live in the browser, not on the server. The API key is
 * encrypted before it is written, so it is never persisted in plaintext.
 *
 * Two backends are available: IndexedDB for the browser and an in memory
 * backend that is used when IndexedDB is not available, for example in tests.
 */

import { decryptApiKey, encryptApiKey } from './crypto.client';
import { isProviderType, type ProviderType, type StoredProvider } from './types';

const DATABASE_NAME = 'boltProviders';
const DATABASE_VERSION = 1;
const STORE_NAME = 'providers';

export interface VaultBackend {
  read(): Promise<StoredProvider[]>;
  write(providers: StoredProvider[]): Promise<void>;
}

export class MemoryVaultBackend implements VaultBackend {
  private _providers: StoredProvider[] = [];

  async read() {
    return [...this._providers];
  }

  async write(providers: StoredProvider[]) {
    this._providers = [...providers];
  }
}

export class IndexedDbVaultBackend implements VaultBackend {
  #database: Promise<IDBDatabase>;

  constructor(databaseName = DATABASE_NAME) {
    this.#database = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async read(): Promise<StoredProvider[]> {
    const db = await this.#database;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();

      request.onsuccess = () => resolve(request.result as StoredProvider[]);
      request.onerror = () => reject(request.error);
    });
  }

  async write(providers: StoredProvider[]): Promise<void> {
    const db = await this.#database;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      store.clear();

      for (const provider of providers) {
        store.put(provider);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export interface ProviderInput {
  type: ProviderType;
  name: string;
  baseUrl?: string;
  apiKey: string;
  modelId?: string;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `provider-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The vault that stores the providers of this browser.
 */
export class ProviderVault {
  #backend: VaultBackend;

  constructor(backend: VaultBackend) {
    this.#backend = backend;
  }

  static create(backend?: VaultBackend): ProviderVault {
    if (backend) {
      return new ProviderVault(backend);
    }

    if (typeof indexedDB === 'undefined') {
      return new ProviderVault(new MemoryVaultBackend());
    }

    return new ProviderVault(new IndexedDbVaultBackend());
  }

  async list(): Promise<StoredProvider[]> {
    const providers = await this.#backend.read();

    return providers.filter((provider) => isProviderType(provider.type));
  }

  async get(id: string): Promise<StoredProvider | undefined> {
    const providers = await this.list();

    return providers.find((provider) => provider.id === id);
  }

  /**
   * Adds a provider. The API key is encrypted before it is stored.
   */
  async add(input: ProviderInput): Promise<StoredProvider> {
    const providers = await this.list();

    const secret = await encryptApiKey(input.apiKey);

    const provider: StoredProvider = {
      id: createId(),
      type: input.type,
      name: input.name.trim() || 'Provider',
      baseUrl: input.baseUrl?.trim() || undefined,
      modelId: input.modelId?.trim() || undefined,
      ...secret,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.#backend.write([...providers, provider]);

    return provider;
  }

  /**
   * Updates a provider. The API key is only replaced when a new one is given.
   */
  async update(
    id: string,
    changes: Partial<Omit<ProviderInput, 'apiKey'>> & { apiKey?: string },
  ): Promise<StoredProvider> {
    const providers = await this.list();

    const index = providers.findIndex((provider) => provider.id === id);

    if (index === -1) {
      throw new Error('The provider does not exist.');
    }

    const current = providers[index];

    const secret = changes.apiKey ? await encryptApiKey(changes.apiKey) : undefined;

    const updated: StoredProvider = {
      ...current,
      ...(changes.type ? { type: changes.type } : {}),
      ...(changes.name !== undefined ? { name: changes.name.trim() || current.name } : {}),
      ...(changes.baseUrl !== undefined ? { baseUrl: changes.baseUrl.trim() || undefined } : {}),
      ...(changes.modelId !== undefined ? { modelId: changes.modelId.trim() || undefined } : {}),
      ...(secret ?? {}),
      updatedAt: new Date().toISOString(),
    };

    providers[index] = updated;

    await this.#backend.write(providers);

    return updated;
  }

  /**
   * Removes a provider and its stored credential.
   */
  async remove(id: string): Promise<void> {
    const providers = await this.list();

    await this.#backend.write(providers.filter((provider) => provider.id !== id));
  }

  /**
   * Decrypts the API key of a provider.
   *
   * The result must never be stored or logged.
   */
  async revealApiKey(id: string): Promise<string | undefined> {
    const provider = await this.get(id);

    if (!provider) {
      return undefined;
    }

    return decryptApiKey(provider);
  }
}
