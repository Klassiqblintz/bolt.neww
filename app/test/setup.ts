import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

/**
 * Shared test setup.
 *
 * The suite runs in the Node environment by default, so nothing here may touch
 * a DOM global unless a DOM actually exists. A component test opts into a DOM
 * with a `@vitest-environment jsdom` comment, and only then is there a document
 * to clean up or a browser API to polyfill.
 */

const hasDom = typeof document !== 'undefined';

if (hasDom) {
  /**
   * JSDOM implements no layout, so `matchMedia` is missing until it is asked
   * for. The app-shell and responsive components call it, and they only care
   * whether the query matches.
   */
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  /**
   * JSDOM has no scroll behaviour, and a component that scrolls an element
   * into view would otherwise throw.
   */
  if (typeof window.HTMLElement.prototype.scrollIntoView !== 'function') {
    window.HTMLElement.prototype.scrollIntoView = () => undefined;
  }
}

/**
 * Unmounts every tree a test rendered, so the next test starts from an empty
 * document. Without it a leftover portal or dialog would leak into the next
 * test and the failures would be order dependent.
 */
afterEach(async () => {
  if (!hasDom) {
    return;
  }

  const { cleanup } = await import('@testing-library/react');

  cleanup();
});
