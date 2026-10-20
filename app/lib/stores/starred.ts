import { atom } from 'nanostores';

/**
 * The chat ids the user starred in the sidebar.
 *
 * Starring is a purely client-side preference, backed by localStorage, so it
 * survives a reload without a server account. The set is replaced (never
 * mutated) on every change so `@nanostores/react` re-renders subscribers.
 */

const STORAGE_KEY = 'bolt_starred_chats';

function readStarredIds(): string[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export const starredChats = atom<Set<string>>(new Set(readStarredIds()));

export function isStarred(id: string): boolean {
  return starredChats.get().has(id);
}

export function toggleStar(id: string): void {
  const next = new Set(starredChats.get());

  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  starredChats.set(next);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // storage is unavailable, the star is then only kept for this session
  }
}
