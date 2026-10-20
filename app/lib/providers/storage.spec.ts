import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryVaultBackend, ProviderVault } from '~/lib/providers/storage.client';

/**
 * The vault is tested with the in memory backend, the IndexedDB backend only
 * differs in how it persists the same records.
 *
 * The encryption is browser only, so the tests verify that the plaintext key
 * never reaches the storage layer.
 */

/**
 * The vault keeps its secret in the browser storage, so a minimal storage is
 * provided for the test run.
 */
function createLocalStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorage());
});

const backend = new MemoryVaultBackend();

function createVault() {
  return new ProviderVault(backend);
}

beforeEach(async () => {
  await backend.write([]);
});

describe('provider vault', () => {
  it('adds a provider', async () => {
    const vault = createVault();

    const provider = await vault.add({
      type: 'openrouter',
      name: 'My provider',
      apiKey: 'sk-or-test-key',
      modelId: 'openai/gpt-4o',
    });

    expect(provider.name).toBe('My provider');
    expect(provider.type).toBe('openrouter');
    expect(provider.modelId).toBe('openai/gpt-4o');

    const stored = await vault.list();

    expect(stored).toHaveLength(1);
  });

  it('never stores the api key in plaintext', async () => {
    const vault = createVault();

    await vault.add({ type: 'openrouter', name: 'Provider', apiKey: 'sk-or-super-secret' });

    const raw = JSON.stringify(await backend.read());

    expect(raw).not.toContain('sk-or-super-secret');
    expect(raw).toContain('encryptedKey');
  });

  it('edits a provider', async () => {
    const vault = createVault();

    const provider = await vault.add({ type: 'openrouter', name: 'Before', apiKey: 'sk-or-one' });

    const updated = await vault.update(provider.id, { name: 'After', modelId: 'anthropic/claude-3.5-sonnet' });

    expect(updated.name).toBe('After');
    expect(updated.modelId).toBe('anthropic/claude-3.5-sonnet');
    expect(updated.type).toBe('openrouter');
  });

  it('keeps the stored key when no new one is given', async () => {
    const vault = createVault();

    const provider = await vault.add({ type: 'openrouter', name: 'Provider', apiKey: 'sk-or-one' });

    const before = (await backend.read())[0].encryptedKey;

    await vault.update(provider.id, { name: 'Renamed' });

    const after = (await backend.read())[0].encryptedKey;

    expect(after).toBe(before);
  });

  it('removes a provider and its credential', async () => {
    const vault = createVault();

    const provider = await vault.add({ type: 'openrouter', name: 'Provider', apiKey: 'sk-or-one' });

    await vault.remove(provider.id);

    expect(await vault.list()).toHaveLength(0);
    expect(JSON.stringify(await backend.read())).not.toContain('sk-or-one');
  });

  it('reports an unknown provider when it is edited', async () => {
    const vault = createVault();

    await expect(vault.update('does-not-exist', { name: 'x' })).rejects.toThrow();
  });

  it('rejects a provider with an unknown type', async () => {
    const vault = createVault();

    await vault.add({ type: 'openrouter', name: 'Provider', apiKey: 'sk-or-one' });

    const stored = await backend.read();

    stored[0].type = 'made-up' as never;

    await backend.write(stored);

    expect(await vault.list()).toHaveLength(0);
  });
});

describe('credential isolation', () => {
  it('keeps the credentials of two vaults apart', async () => {
    const firstBackend = new MemoryVaultBackend();
    const secondBackend = new MemoryVaultBackend();

    const first = new ProviderVault(firstBackend);
    const second = new ProviderVault(secondBackend);

    await first.add({ type: 'openrouter', name: 'First', apiKey: 'sk-or-first' });
    await second.add({ type: 'anthropic', name: 'Second', apiKey: 'sk-ant-second' });

    expect(await first.list()).toHaveLength(1);
    expect(await second.list()).toHaveLength(1);

    expect((await first.list())[0].type).toBe('openrouter');
    expect((await second.list())[0].type).toBe('anthropic');

    expect(JSON.stringify(await firstBackend.read())).not.toContain('sk-ant-second');
    expect(JSON.stringify(await secondBackend.read())).not.toContain('sk-or-first');
  });

  it('does not leak a key when a provider is removed', async () => {
    const vault = createVault();

    const provider = await vault.add({ type: 'openrouter', name: 'Provider', apiKey: 'sk-or-secret' });

    await vault.remove(provider.id);

    expect(JSON.stringify(await backend.read())).not.toContain('sk-or-secret');
  });
});
