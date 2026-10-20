import { describe, expect, it } from 'vitest';
import { readRecentOpened, recordChatOpened, RECENT_STORAGE_KEY, type StorageLike } from '~/lib/stores/recentlyViewed';

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

describe('recently viewed', () => {
  it('records when a conversation was opened', () => {
    const storage = createStorage();

    recordChatOpened('42', storage, new Date('2024-06-01T10:00:00.000Z'));

    expect(readRecentOpened(storage)['42']).toBe('2024-06-01T10:00:00.000Z');
  });

  it('updates the timestamp when a conversation is opened again', () => {
    const storage = createStorage();

    recordChatOpened('42', storage, new Date('2024-06-01T10:00:00.000Z'));
    recordChatOpened('42', storage, new Date('2024-06-02T10:00:00.000Z'));

    expect(readRecentOpened(storage)['42']).toBe('2024-06-02T10:00:00.000Z');
  });

  it('survives a simulated reload', () => {
    const storage = createStorage();

    recordChatOpened('7', storage, new Date('2024-06-01T10:00:00.000Z'));

    expect(readRecentOpened(createStorage({ ...storage.data }))['7']).toBe('2024-06-01T10:00:00.000Z');
  });

  it('keeps the map bounded', () => {
    const storage = createStorage();

    for (let i = 0; i < 100; i++) {
      recordChatOpened(String(i), storage, new Date(1700000000000 + i * 1000));
    }

    expect(Object.keys(readRecentOpened(storage)).length).toBeLessThanOrEqual(50);
  });

  it('ignores corrupted data instead of throwing', () => {
    expect(readRecentOpened(createStorage({ [RECENT_STORAGE_KEY]: '{broken' }))).toEqual({});
    expect(readRecentOpened(createStorage({ [RECENT_STORAGE_KEY]: '[1,2,3]' }))).toEqual({});
    expect(readRecentOpened(undefined)).toEqual({});
  });

  it('only stores ids and timestamps, never message content', () => {
    const storage = createStorage();

    recordChatOpened('9', storage);

    const raw = storage.data[RECENT_STORAGE_KEY];

    expect(raw).toContain('9');
    expect(Object.keys(JSON.parse(raw) as object)).toEqual(['9']);
  });
});
