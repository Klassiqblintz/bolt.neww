import { useStore } from '@nanostores/react';
import { useLocation } from '@remix-run/react';
import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { useProviderStatus } from '~/lib/hooks';
import { db, deleteById, getAll, chatId, type ChatHistoryItem } from '~/lib/persistence';
import { menuOpenStore } from '~/lib/stores/menu';
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

interface NavItem {
  label: string;
  icon: string;
  href: string;

  /** Whether the destination counts as active for this pathname. */
  matches?: (pathname: string) => boolean;
}

/**
 * The main navigation of the sidebar. Every entry is a real destination that
 * reuses an existing route or one of the new pages, none of them is a filter
 * or a placeholder.
 */
const PRIMARY_NAV: NavItem[] = [
  { label: 'Home', icon: 'i-ph:house', href: '/', matches: (path) => path === '/' },
  { label: 'Projects', icon: 'i-ph:folder-notch', href: '/projects', matches: (path) => path === '/projects' },
  { label: 'Starred', icon: 'i-ph:star', href: '/starred', matches: (path) => path === '/starred' },
  {
    label: 'Recently viewed',
    icon: 'i-ph:clock-counter-clockwise',
    href: '/recently-viewed',
    matches: (path) => path === '/recently-viewed',
  },
  { label: 'Live chat', icon: 'i-ph:broadcast', href: '/', matches: (path) => path.startsWith('/chat/') },
];

const PROVIDER_NAV: NavItem[] = [
  { label: 'AI providers', icon: 'i-ph:plugs', href: '/providers', matches: (path) => path === '/providers' },
];

const SECONDARY_NAV: NavItem[] = [
  { label: 'Help center', icon: 'i-ph:question', href: '/help', matches: (path) => path === '/help' },
  {
    label: 'Release notes',
    icon: 'i-ph:lightning',
    href: '/release-notes',
    matches: (path) => path === '/release-notes',
  },
  { label: 'Status', icon: 'i-ph:path', href: '/status', matches: (path) => path === '/status' },
];

/**
 * Chat history sidebar.
 *
 * It is opened and closed by the header toggle and the backdrop, so it stays
 * in sync on touch devices too. There is no hover-to-open: that silently
 * fought the header button and made the toggle feel broken.
 */
export function Menu() {
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const open = useStore(menuOpenStore);
  const currentChatId = useStore(chatId);
  const providerStatus = useProviderStatus();
  const { pathname } = useLocation();

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

  const liveChatHref = currentChatId ? `/chat/${currentChatId}` : '/';

  const renderNavItem = (item: NavItem) => {
    const href = item.label === 'Live chat' ? liveChatHref : item.href;
    const active = item.matches?.(pathname) ?? false;

    return (
      <a
        key={item.label}
        href={href}
        aria-current={active ? 'page' : undefined}
        onClick={closeSidebar}
        className={classNames(
          'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150',
          active
            ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent font-medium'
            : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive',
        )}
      >
        <span className={classNames(item.icon, 'text-lg shrink-0')} aria-hidden="true" />
        <span className="truncate">{item.label}</span>
      </a>
    );
  };

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
          <a href="/" onClick={closeSidebar} className="font-semibold text-bolt-elements-textPrimary">
            Bolt
          </a>
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
          <nav aria-label="Main navigation" className="flex flex-col gap-0.5 px-2 pt-1">
            {PRIMARY_NAV.map(renderNavItem)}
          </nav>

          <div className="my-2 border-t border-bolt-elements-borderColor" />

          <nav aria-label="Provider navigation" className="flex flex-col gap-0.5 px-2">
            {PROVIDER_NAV.map(renderNavItem)}
          </nav>

          <div className="my-2 border-t border-bolt-elements-borderColor" />

          <nav aria-label="Secondary navigation" className="flex flex-col gap-0.5 px-2">
            {SECONDARY_NAV.map(renderNavItem)}
          </nav>

          <div className="text-bolt-elements-textPrimary font-medium pl-4 pr-5 mt-4 mb-1">Your Chats</div>

          <div className="flex-1 overflow-scroll pl-4 pr-5 pb-5">
            {list.length === 0 && <div className="pl-2 text-bolt-elements-textTertiary">No previous conversations</div>}
            <DialogRoot open={dialogContent !== null}>
              {binDates(list).map(({ category, items }) => (
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

          <div className="flex items-center gap-2 border-t border-bolt-elements-borderColor p-4">
            <a
              href="/status"
              onClick={closeSidebar}
              className="flex items-center gap-2 min-w-0 text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary transition-colors duration-150"
              title="Open the status page"
            >
              <span
                className={classNames('inline-block shrink-0', {
                  'i-ph:circle-fill text-bolt-elements-icon-success': providerStatus?.configured === true,
                  'i-ph:warning-circle-bold text-bolt-elements-icon-error':
                    providerStatus !== undefined && !providerStatus.configured,
                  'i-ph:circle-dashed text-bolt-elements-textTertiary': providerStatus === undefined,
                })}
                aria-hidden="true"
              />
              <span className="truncate">
                {providerStatus?.configured
                  ? `AI ready · ${providerStatus.provider}`
                  : providerStatus
                    ? 'AI provider not configured'
                    : 'Checking AI status…'}
              </span>
            </a>
            <ThemeSwitch className="ml-auto shrink-0" />
          </div>
        </div>
      </motion.div>
    </>
  );
}
