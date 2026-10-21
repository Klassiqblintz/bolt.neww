/**
 * Small URL helpers for the app shell.
 *
 * They are plain functions so the flag handling can be tested without a
 * browser, and they only ever touch `window` when they are given one.
 */

export const PERSISTENCE_ERROR_PARAM = 'persistError';

/** Adds the persistence error flag to an href, keeping the rest of the URL. */
export function withPersistenceErrorFlag(href: string): string {
  const url = new URL(href, 'http://localhost');

  url.searchParams.set(PERSISTENCE_ERROR_PARAM, '1');

  return `${url.pathname}${url.search}${url.hash}`;
}

/** Removes the persistence error flag from an href. */
export function withoutPersistenceErrorFlag(href: string): string {
  const url = new URL(href, 'http://localhost');

  url.searchParams.delete(PERSISTENCE_ERROR_PARAM);

  return `${url.pathname}${url.search}${url.hash}`;
}

/** Whether an href carries the persistence error flag. */
export function hasPersistenceErrorFlag(href: string): boolean {
  return new URL(href, 'http://localhost').searchParams.has(PERSISTENCE_ERROR_PARAM);
}
