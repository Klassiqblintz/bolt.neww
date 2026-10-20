import { atom } from 'nanostores';

/**
 * Whether the workbench panel is open.
 *
 * This lives in its own module so that server rendered components can read it
 * without pulling in the workbench store (and with it the browser only
 * `path` polyfill), which cannot be evaluated during SSR.
 */
export const showWorkbenchStore = atom<boolean>(import.meta.hot?.data.showWorkbench ?? false);

if (import.meta.hot) {
  import.meta.hot.data.showWorkbench = showWorkbenchStore;
}
