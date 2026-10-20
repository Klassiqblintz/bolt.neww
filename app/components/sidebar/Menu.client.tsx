import { useStore } from '@nanostores/react';
import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { useProviderStatus } from '~/lib/hooks';
import { db, deleteById, getAll, chatId, type ChatHistoryItem } from '~/lib/persistence';
import { menuOpenStore } from '~/lib/stores/menu';
import { starredChats } from '~/lib/stores/starred';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-150px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent = { type: 'delete'; item: ChatHistoryItem } | null;

type ChatFilter = 'recent' | 'starred';

/**
 * Chat history sidebar.
 *
 * It is opened and closed by the header toggle and the backdrop, so it stays
 * in sync on touch devices too. There is no hover-to-open anymore: that
 * silently fought the header button and made the toggle feel broken.
 */
export function Menu() {
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [filter, setFilter] = useState<ChatFilter>('recent');
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const open = useStore(menuOpenStore);
  const starred = useStore(starredChats);
  const currentChatId = useStore(chatId);
  const providerStatus = useProviderStatus();

  const loadEntries = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));
    }
  }, []);

  const deleteItem = useCallback((event: React.UIEvent, item: ChatHistoryItem) => {
    event.preventDefault();

    if (db) {
      deleteById(db, item.id)
        .then(() => {
          loadEntries();

          if (chatId.get() === item.id) {
            // hard page navigation to clear the stores
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          toast.error('Failed to delete conversation');
          logger.error(error);
        });
    }
  }, []);

  const closeSidebar = useCallback(() => {
    menuOpenStore.set(false);
  }, []);

  const closeDialog = () => {
    setDialogContent(null);
  };

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open]);

  /**
   * Esc closes the sidebar. The header button and the backdrop close it with a
   * click, so this also gives keyboard users a way out.
   */
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        menuOpenStore.set(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const visibleItems = filter === 'starred' ? list.filter((item) => starred.has(item.id)) : list;

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-menu-backdrop bg-black/40 backdrop-blur-[1px]"
          onClick={closeSidebar}
        />
      )}

      <motion.div
        id="side-menu"
        initial="closed"
        animate={open ? 'open' : 'closed'}
        variants={menuVariants}
        aria-label="Sidebar"
        aria-hidden={!open}
        className="flex flex-col side-menu fixed top-0 w-[350px] max-w-[85vw] h-full bg-bolt-elements-background-depth-2 border-r rounded-r-3xl border-bolt-elements-borderColor z-sidebar shadow-xl shadow-bolt-elements-sidebar-dropdownShadow text-sm"
      >
        <div className="flex items-center justify-between h-[var(--header-height)] pl-4 pr-3">
          <span className="text-bolt-elements-textPrimary font-semibold">Bolt</span>
          <button
            type="button"
            className="p-1.5 rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-colors duration-150"
            title="Close sidebar"
            aria-label="Close sidebar"
            onClick={closeSidebar}
          >
            <div className="i-ph:x text-lg" />
          </button>
        </div>

        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          <div className="p-4 flex flex-col gap-1">
            <a
              href="/"
              onClick={closeSidebar}
              className="flex gap-2 items-center bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover rounded-md p-2 transition-theme"
            >
              <span className="inline-block i-bolt:chat scale-110" />
              Start new chat
            </a>
            <a
              href={currentChatId ? `/chat/${currentChatId}` : '/'}
              onClick={closeSidebar}
              className="flex gap-2 items-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive rounded-md p-2 transition-theme"
            >
              <span className="inline-block i-ph:broadcast scale-110" />
              Live chat
            </a>
            <a
              href="/providers"
              onClick={closeSidebar}
              className="flex gap-2 items-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive rounded-md p-2 transition-theme"
            >
              <span className="inline-block i-ph:plugs scale-110" />
              AI providers
            </a>
          </div>

          <div className="flex flex-col gap-1 border-t border-bolt-elements-borderColor pt-3 pb-1 px-4">
            <a
              href="https://github.com/stackblitz/bolt.new#readme"
              target="_blank"
              rel="noreferrer"
              onClick={closeSidebar}
              className="flex gap-2 items-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive rounded-md p-2 transition-theme"
            >
              <span className="inline-block i-ph:question scale-110" />
              Help center
              <span className="ml-auto i-ph:arrow-square-out text-sm opacity-60" />
            </a>
            <a
              href="https://github.com/stackblitz/bolt.new/releases"
              target="_blank"
              rel="noreferrer"
              onClick={closeSidebar}
              className="flex gap-2 items-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive rounded-md p-2 transition-theme"
            >
              <span className="inline-block i-ph:lightning scale-110" />
              Release notes
              <span className="ml-auto i-ph:arrow-square-out text-sm opacity-60" />
            </a>
            <div
              className="flex gap-2 items-center text-bolt-elements-textTertiary rounded-md p-2"
              title="Provider status is read from the server"
            >
              <span
                className={classNames('inline-block scale-110', {
                  'i-ph:circle-fill text-bolt-elements-icon-success': providerStatus?.configured === true,
                  'i-ph:warning-circle-bold text-bolt-elements-icon-error':
                    providerStatus !== undefined && !providerStatus.configured,
                  'i-ph:circle-dashed text-bolt-elements-textTertiary': providerStatus === undefined,
                })}
              />
              {providerStatus?.configured
                ? `AI ready · ${providerStatus.provider}`
                : providerStatus
                  ? 'AI provider not configured'
                  : 'Checking AI status…'}
            </div>
          </div>

          <div className="text-bolt-elements-textPrimary font-medium pl-6 pr-5 my-2">Your Chats</div>

          <div className="flex gap-1 px-4 pb-2">
            <button
              type="button"
              className={classNames(
                'rounded-full px-3 py-1 text-xs transition-colors duration-150',
                filter === 'recent'
                  ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                  : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive',
              )}
              onClick={() => setFilter('recent')}
            >
              Recent
            </button>
            <button
              type="button"
              className={classNames(
                'rounded-full px-3 py-1 text-xs transition-colors duration-150',
                filter === 'starred'
                  ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                  : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive',
              )}
              onClick={() => setFilter('starred')}
            >
              Starred
            </button>
          </div>

          <div className="flex-1 overflow-scroll pl-4 pr-5 pb-5">
            {visibleItems.length === 0 && (
              <div className="pl-2 text-bolt-elements-textTertiary">
                {filter === 'starred'
                  ? 'No starred chats yet. Star a chat to keep it here.'
                  : 'No previous conversations'}
              </div>
            )}
            <DialogRoot open={dialogContent !== null}>
              {binDates(visibleItems).map(({ category, items }) => (
                <div key={category} className="mt-4 first:mt-0 space-y-1">
                  <div className="text-bolt-elements-textTertiary sticky top-0 z-1 bg-bolt-elements-background-depth-2 pl-2 pt-2 pb-1">
                    {category}
                  </div>
                  {items.map((item) => (
                    <HistoryItem
                      key={item.id}
                      item={item}
                      onDelete={() => setDialogContent({ type: 'delete', item })}
                    />
                  ))}
                </div>
              ))}
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <DialogTitle>Delete Chat?</DialogTitle>
                    <DialogDescription asChild>
                      <div>
                        <p>
                          You are about to delete <strong>{dialogContent.item.description}</strong>.
                        </p>
                        <p className="mt-1">Are you sure you want to delete this chat?</p>
                      </div>
                    </DialogDescription>
                    <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={(event) => {
                          deleteItem(event, dialogContent.item);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>

          <div className="flex items-center border-t border-bolt-elements-borderColor p-4">
            <ThemeSwitch className="ml-auto" />
          </div>
        </div>
      </motion.div>
    </>
  );
}
