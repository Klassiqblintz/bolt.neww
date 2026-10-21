/**
 * The browser storage surface the client state persists to.
 *
 * Every module that talks to localStorage goes through this seam, so the
 * persistence logic can be tested with a plain object instead of a browser
 * and so a page rendered on the server never touches a browser global.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The real localStorage, or `undefined` where it does not exist.
 *
 * Reading it can also throw when the browser refuses access (a blocked
 * third-party frame, or a hardened privacy setting), so that is treated the
 * same as it not existing.
 */
export function getLocalStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
