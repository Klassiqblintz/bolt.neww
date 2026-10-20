import { atom } from 'nanostores';

/**
 * Controls the visibility of the chat history sidebar.
 *
 * The sidebar opens on hover on desktop, which is not possible on touch
 * devices, so the header also provides a button that toggles this store.
 */
export const menuOpenStore = atom<boolean>(false);
