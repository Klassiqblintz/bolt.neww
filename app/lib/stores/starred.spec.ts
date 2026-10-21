import { afterEach, describe, expect, it } from 'vitest';
import { starredChats } from '~/lib/stores/starred';
import { readStarredIds, STARRED_CHATS_STORAGE_KEY, toggleStar, writeStarredIds } from '~/lib/stores/starred';
import type { StorageLike } from '~/lib/storage';

/**
 * A localStorage stand-in, so the starred state is tested without a browser.
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

/** A storage that always refuses to write, like a blocked private window. */
const refusingStorage: StorageLike = {
  getItem: () => null,
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('QuotaExceededError');
  },
};

afterEach(() => {
  starredChats.set(new Set());
});

describe('reading starred ids', () => {
  it('reads a persisted list', () => {
    const storage = createStorage({ [STARRED_CHATS_STORAGE_KEY]: '["chat-1","chat-2"]' });

    expect(readStarredIds(storage)).toEqual(['chat-1', 'chat-2']);
  });

  it('keeps only the string ids', () => {
    const storage = createStorage({ [STARRED_CHATS_STORAGE_KEY]: '["chat-1",5,"chat-2",null,42]' });

    expect(readStarredIds(storage)).toEqual(['chat-1', 'chat-2']);
  });

  it('drops empty strings', () => {
    const storage = createStorage({ [STARRED_CHATS_STORAGE_KEY]: '["","chat-1"]' });

    expect(readStarredIds(storage)).toEqual(['chat-1']);
  });

  it('ignores corrupted or foreign data instead of throwing', () => {
    expect(readStarredIds(createStorage({ [STARRED_CHATS_STORAGE_KEY]: '{broken' }))).toEqual([]);
    expect(readStarredIds(createStorage({ [STARRED_CHATS_STORAGE_KEY]: '{"chat-1":true}' }))).toEqual([]);
    expect(readStarredIds(createStorage({ [STARRED_CHATS_STORAGE_KEY]: '"chat-1"' }))).toEqual([]);
    expect(readStarredIds(createStorage({ [STARRED_CHATS_STORAGE_KEY]: '5' }))).toEqual([]);
  });

  it('returns nothing where storage does not exist', () => {
    expect(readStarredIds(undefined)).toEqual([]);
  });
});

describe('writing starred ids', () => {
  it('writes the ids as an array', () => {
    const storage = createStorage();

    writeStarredIds(new Set(['chat-2', 'chat-1']), storage);

    expect(JSON.parse(storage.data[STARRED_CHATS_STORAGE_KEY])).toEqual(['chat-2', 'chat-1']);
  });

  it('writes an empty list when nothing is starred', () => {
    const storage = createStorage({ [STARRED_CHATS_STORAGE_KEY]: '["chat-1"]' });

    writeStarredIds(new Set(), storage);

    expect(storage.data[STARRED_CHATS_STORAGE_KEY]).toBe('[]');
  });

  it('never stores anything that looks like a credential', () => {
    const storage = createStorage();

    writeStarredIds(new Set(['chat-1']), storage);

    expect(storage.data[STARRED_CHATS_STORAGE_KEY]).not.toContain('sk-');
    expect(storage.data[STARRED_CHATS_STORAGE_KEY]).not.toContain('apiKey');
  });

  it('does nothing where storage does not exist', () => {
    expect(() => writeStarredIds(new Set(['chat-1']), undefined)).not.toThrow();
  });
});

describe('toggling a star', () => {
  it('adds and removes a chat', () => {
    const storage = createStorage();

    toggleStar('chat-1', storage);

    expect(starredChats.get().has('chat-1')).toBe(true);
    expect(readStarredIds(storage)).toEqual(['chat-1']);

    toggleStar('chat-1', storage);

    expect(starredChats.get().has('chat-1')).toBe(false);
    expect(readStarredIds(storage)).toEqual([]);
  });

  it('keeps the other chats when one is toggled', () => {
    const storage = createStorage();

    toggleStar('chat-1', storage);
    toggleStar('chat-2', storage);
    toggleStar('chat-1', storage);

    expect([...starredChats.get()]).toEqual(['chat-2']);
    expect(readStarredIds(storage)).toEqual(['chat-2']);
  });

  it('replaces the set so subscribers re-render', () => {
    const before = starredChats.get();

    toggleStar('chat-1', createStorage());

    expect(starredChats.get()).not.toBe(before);
  });

  it('keeps the stars for the session when the browser refuses storage', () => {
    expect(() => toggleStar('chat-1', refusingStorage)).not.toThrow();

    expect(starredChats.get().has('chat-1')).toBe(true);
  });
});

describe('surviving a reload', () => {
  it('restores what was written', () => {
    const storage = createStorage();

    toggleStar('chat-1', storage);
    toggleStar('chat-2', storage);

    /**
     * The in memory atom is reset while the same storage data survives,
     * which is exactly what a page reload does.
     */
    starredChats.set(new Set());

    starredChats.set(new Set(readStarredIds(storage)));

    expect(starredChats.get().has('chat-1')).toBe(true);
    expect(starredChats.get().has('chat-2')).toBe(true);
  });
});
