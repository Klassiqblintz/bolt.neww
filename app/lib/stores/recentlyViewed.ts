import { getLocalStorage, type StorageLike } from '~/lib/storage';

/**
 * Tracks when a conversation was last opened.
 *
 * The app has no accounts, so the map lives in a clearly scoped localStorage
 * entry (`bolt_recent_opened`). It only records real chat ids from the
 * IndexedDB history, it never invents entries. Corrupted data is ignored.
 */

export const RECENT_STORAGE_KEY = 'bolt_recent_opened';

export type RecentOpenedMap = Record<string, string>;

export type { StorageLike };

export function readRecentOpened(storage: StorageLike | undefined = getLocalStorage()): RecentOpenedMap {
  if (!storage) {
    return {};
  }

  try {
    const raw = storage.getItem(RECENT_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const result: RecentOpenedMap = {};

    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === 'string') {
        result[id] = value;
      }
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Records that a conversation was opened now.
 */
export function recordChatOpened(
  id: string,
  storage: StorageLike | undefined = getLocalStorage(),
  now = new Date(),
): void {
  if (!storage || !id) {
    return;
  }

  try {
    const current = readRecentOpened(storage);

    current[id] = now.toISOString();

    /**
     * The map only needs the most recent openings, older entries are dropped
     * so the entry cannot grow without bound.
     */
    const trimmed = Object.entries(current)
      .sort((a, b) => (a[1] < b[1] ? 1 : -1))
      .slice(0, 50);

    storage.setItem(RECENT_STORAGE_KEY, JSON.stringify(Object.fromEntries(trimmed)));
  } catch {
    /**
     * The browser refuses storage, the recency is then only kept for the
     * session (the chat timestamp is still used as a fallback).
     */
  }
}
