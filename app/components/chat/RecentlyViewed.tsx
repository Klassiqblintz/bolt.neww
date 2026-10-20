import { useStore } from '@nanostores/react';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import type { ChatHistoryItem } from '~/lib/persistence';
import { themeStore } from '~/lib/stores/theme';

const MAX_ITEMS = 6;

/**
 * Homepage section that lists previously saved chats (real IndexedDB records).
 * Renders a helpful empty state when there is no history yet.
 */
export function RecentlyViewed() {
  const [items, setItems] = useState<ChatHistoryItem[] | undefined>(undefined);
  const theme = useStore(themeStore);

  useEffect(() => {
    let cancelled = false;

    /**
     * The persistence module pulls in the workbench (and therefore the Node
     * `path` polyfill), which cannot be evaluated during SSR. It is therefore
     * loaded lazily, in the browser only.
     */
    async function loadRecent() {
      const { db, getAll } = await import('~/lib/persistence');

      if (!db) {
        if (!cancelled) {
          setItems([]);
        }

        return;
      }

      try {
        const list = await getAll(db);

        if (!cancelled) {
          setItems(
            list
              .filter((item) => item.urlId && item.description)
              .toSorted((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
              .slice(0, MAX_ITEMS),
          );
        }
      } catch (error) {
        toast.error('Failed to load recent projects');
        console.error(error);

        if (!cancelled) {
          setItems([]);
        }
      }
    }

    loadRecent().catch((error) => {
      console.error(error);

      if (!cancelled) {
        setItems([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // avoid flashing the empty state before the async DB read finishes
  if (items === undefined) {
    return null;
  }

  return (
    <section className="w-full max-w-chat mx-auto px-1" aria-label="Recently viewed projects">
      <h2 className="flex items-center gap-2 text-sm font-medium text-bolt-elements-textSecondary mb-3">
        <div className="i-ph:clock-counter-clockwise text-base" />
        Recently viewed
      </h2>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-bolt-elements-borderColor px-4 py-6 text-center">
          <div className="i-ph:chat-circle-dots text-2xl text-bolt-elements-textTertiary" />
          <p className="text-sm text-bolt-elements-textSecondary">No recent projects yet</p>
          <p className="text-xs text-bolt-elements-textTertiary">
            Projects you build with Bolt will show up here so you can pick up where you left off.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`/chat/${item.urlId}`}
                className="group flex flex-col gap-1 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-4 py-3 transition-theme hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-background-depth-2"
                data-theme={theme}
              >
                <span className="flex items-center gap-2 text-sm text-bolt-elements-textPrimary truncate">
                  <div className="i-ph:squares-four text-base text-bolt-elements-textTertiary shrink-0" />
                  <span className="truncate">{item.description}</span>
                </span>
                <span className="text-xs text-bolt-elements-textTertiary pl-6">
                  {formatRelativeTime(item.timestamp)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatRelativeTime(timestamp: string): string {
  const parsed = Date.parse(timestamp);

  if (Number.isNaN(parsed)) {
    return '';
  }

  return formatDistanceToNow(new Date(parsed), { addSuffix: true });
}
