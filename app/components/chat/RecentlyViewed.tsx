import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import type { ChatHistoryItem } from '~/lib/persistence';

const MAX_ITEMS = 6;

/**
 * Homepage section that lists previously saved chats (real IndexedDB records).
 * Renders a helpful empty state when there is no history yet.
 */
export function RecentlyViewed() {
  const [items, setItems] = useState<ChatHistoryItem[] | undefined>(undefined);

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
    <section className="w-full" aria-label="Recently viewed projects">
      <div className="flex items-center gap-2 text-sm font-medium text-bolt-elements-textSecondary mb-3">
        <div className="i-ph:clock-counter-clockwise text-base" />
        Recently viewed
      </div>

      {items.length === 0 ? (
        <div
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-bolt-elements-borderColor px-4 py-7 text-center"
          style={{ background: 'var(--bolt-elements-surface-card)' }}
        >
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl mb-1"
            style={{
              background: 'var(--bolt-elements-surface-cardIcon)',
              color: 'var(--bolt-elements-surface-cardIconText)',
            }}
          >
            <div className="i-ph:folder-open text-xl" />
          </div>
          <p className="text-sm font-medium text-bolt-elements-textPrimary">No recent projects yet</p>
          <p className="text-xs text-bolt-elements-textTertiary max-w-sm">
            Projects you build with Bolt will show up here, so you can pick up where you left off.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`/chat/${item.urlId}`}
                className="group flex items-start gap-3 rounded-2xl border px-3.5 py-3 transition-all duration-150 hover:-translate-y-px"
                style={{
                  background: 'var(--bolt-elements-surface-card)',
                  borderColor: 'var(--bolt-elements-surface-cardBorder)',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = 'var(--bolt-elements-surface-cardHover)';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'var(--bolt-elements-surface-card)';
                }}
              >
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5"
                  style={{
                    background: 'var(--bolt-elements-surface-cardIcon)',
                    color: 'var(--bolt-elements-surface-cardIconText)',
                  }}
                >
                  <div className="i-ph:code text-base" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-bolt-elements-textPrimary truncate group-hover:text-bolt-elements-item-contentAccent transition-colors duration-150">
                    {item.description}
                  </span>
                  <span className="block text-xs text-bolt-elements-textTertiary mt-0.5">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </span>

                <div className="i-ph:arrow-right text-base text-bolt-elements-textTertiary opacity-0 group-hover:opacity-100 transition-opacity duration-150 mt-1 shrink-0" />
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
