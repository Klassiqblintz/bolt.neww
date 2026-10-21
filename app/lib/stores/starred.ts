import { atom } from 'nanostores';
import { getLocalStorage, type StorageLike } from '~/lib/storage';

/**
 * The chat ids the user starred in the sidebar.
 *
 * Starring is a purely client-side preference, backed by localStorage, so it
 * survives a reload without a server account. The set is replaced (never
 * mutated) on every change so `@nanostores/react` re-renders subscribers.
 *
 * Reads and writes go through a storage seam, so the behaviour is testable
 * without a browser and a missing or refused storage degrades to keeping the
 * stars for the session only.
 */

export const STARRED_CHATS_STORAGE_KEY = 'bolt_starred_chats';

/**
 * Reads the starred ids. Corrupted or foreign data is ignored instead of
 * throwing, a broken entry must never break the sidebar.
 */
export function readStarredIds(storage: StorageLike | undefined = getLocalStorage()): string[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(STARRED_CHATS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

export function writeStarredIds(ids: ReadonlySet<string>, storage: StorageLike | undefined = getLocalStorage()): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(STARRED_CHATS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /**
     * The browser refuses storage (private mode, quota). The stars are then
     * only kept for the session.
     */
  }
}

export const starredChats = atom<Set<string>>(new Set(readStarredIds()));

export function isStarred(id: string): boolean {
  return starredChats.get().has(id);
}

export function toggleStar(id: string, storage: StorageLike | undefined = getLocalStorage()): void {
  const next = new Set(starredChats.get());

  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  starredChats.set(next);

  writeStarredIds(next, storage);
}
