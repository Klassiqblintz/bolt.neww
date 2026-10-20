import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useState } from 'react';
import { db, getAll, type ChatHistoryItem } from '~/lib/persistence';
import { starredChats, toggleStar } from '~/lib/stores/starred';
import { readRecentOpened } from '~/lib/stores/recentlyViewed';
import { classNames } from '~/utils/classNames';

export type ChatListFilter = 'all' | 'starred' | 'recent';

interface ChatListPageProps {
  filter: ChatListFilter;
  emptyHint?: string;
}

const FILTER_COPY: Record<ChatListFilter, { title: string; subtitle: string }> = {
  all: {
    title: 'Projects',
    subtitle: 'Every conversation saved in this browser. Open one to continue where you left off.',
  },
  starred: {
    title: 'Starred',
    subtitle: 'Conversations you starred. The star is saved in this browser.',
  },
  recent: {
    title: 'Recently viewed',
    subtitle: 'Conversations sorted by when you last opened them.',
  },
};

function formatDate(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Lists the conversations that really exist in the IndexedDB history of this
 * browser. Nothing here is invented: when there are no conversations the page
 * says so.
 */
export function ChatListPage({ filter, emptyHint }: ChatListPageProps) {
  const starred = useStore(starredChats);
  const [items, setItems] = useState<ChatHistoryItem[] | undefined>(undefined);

  const load = useCallback(() => {
    if (!db) {
      setItems([]);

      return;
    }

    getAll(db)
      .then((list) => list.filter((item) => item.urlId && item.description))
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copy = FILTER_COPY[filter];

  let visible = items ?? [];

  if (filter === 'starred') {
    visible = visible.filter((item) => starred.has(item.id));
  }

  if (filter === 'recent') {
    const opened = readRecentOpened();

    visible = [...visible].sort((a, b) => {
      const openedA = opened[a.id] ?? a.timestamp;
      const openedB = opened[b.id] ?? b.timestamp;

      return openedA < openedB ? 1 : -1;
    });
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-semibold text-bolt-elements-textPrimary">{copy.title}</h1>
      <p className="mt-1 text-sm text-bolt-elements-textSecondary">{copy.subtitle}</p>

      <div className="mt-6 flex flex-col gap-2">
        {items === undefined && <p className="text-sm text-bolt-elements-textTertiary">Loading conversations…</p>}

        {items !== undefined && visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-bolt-elements-borderColor px-4 py-8 text-center text-sm text-bolt-elements-textTertiary">
            {emptyHint ??
              (filter === 'starred'
                ? 'No starred conversations yet. Star one from the sidebar or here.'
                : 'No conversations yet. Start a chat and your projects will appear here.')}
          </div>
        )}

        {visible.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-3 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-4 py-3 transition-colors duration-150 hover:border-bolt-elements-borderColorActive"
          >
            <a href={`/chat/${item.urlId}`} className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium text-bolt-elements-textPrimary">{item.description}</div>
              <div className="mt-0.5 text-xs text-bolt-elements-textTertiary">{formatDate(item.timestamp)}</div>
            </a>

            <button
              type="button"
              title={starred.has(item.id) ? 'Remove from starred' : 'Star this conversation'}
              aria-label={starred.has(item.id) ? 'Remove from starred' : 'Star this conversation'}
              aria-pressed={starred.has(item.id)}
              className={classNames('p-2 rounded-md transition-colors duration-150 shrink-0', {
                'text-accent-500': starred.has(item.id),
                'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary': !starred.has(item.id),
              })}
              onClick={() => toggleStar(item.id)}
            >
              <div className={classNames('text-lg', starred.has(item.id) ? 'i-ph:star-fill' : 'i-ph:star')} />
            </button>

            <a
              href={`/chat/${item.urlId}`}
              className="shrink-0 text-bolt-elements-textTertiary transition-colors duration-150 group-hover:text-bolt-elements-textPrimary"
              aria-label="Open conversation"
            >
              <div className="i-ph:arrow-right text-lg" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
