import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { hasPersistenceErrorFlag, withoutPersistenceErrorFlag } from '~/lib/app-shell';
import { showWorkbenchStore } from '~/lib/stores/workbenchVisibility';

const WORKBENCH_MEDIA_QUERY = '(min-width: 1024px)';

/**
 * The workbench is hidden by default on a narrow screen and shown by default
 * on a wide one.
 *
 * The desktop default is applied once per load, only when the workbench is not
 * already open. Without it the workbench stays closed on a desktop reload,
 * which is not the intended starting layout.
 */
export function useWorkbenchVisibility() {
  useEffect(() => {
    if (showWorkbenchStore.get()) {
      return;
    }

    if (typeof window.matchMedia !== 'function' || !window.matchMedia(WORKBENCH_MEDIA_QUERY).matches) {
      return;
    }

    showWorkbenchStore.set(true);
  }, []);
}

/**
 * Reports a conversation that was not saved to this browser.
 *
 * The chat history hook adds the `persistError` flag to the chat URL when a
 * save failed, so the notice survives the reload that follows. The flag is
 * removed once it has been shown, so the notice is never repeated.
 */
export function usePersistenceNotice() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const href = window.location.href;

    if (!hasPersistenceErrorFlag(href)) {
      return;
    }

    toast.error('This conversation could not be saved to this browser.');

    window.history.replaceState({}, '', withoutPersistenceErrorFlag(href));
  }, []);
}
