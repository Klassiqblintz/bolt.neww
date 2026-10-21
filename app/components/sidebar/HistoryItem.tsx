import * as Dialog from '@radix-ui/react-dialog';
import { useStore } from '@nanostores/react';
import { useEffect, useRef, useState } from 'react';
import { type ChatHistoryItem } from '~/lib/persistence';
import { starredChats, toggleStar } from '~/lib/stores/starred';
import { classNames } from '~/utils/classNames';

interface HistoryItemProps {
  item: ChatHistoryItem;
  onDelete?: (event: React.UIEvent) => void;

  /** Called when the entry navigates, so the sidebar can close behind it. */
  onNavigate?: () => void;
}

export function HistoryItem({ item, onDelete, onNavigate }: HistoryItemProps) {
  const [hovering, setHovering] = useState(false);
  const hoverRef = useRef<HTMLDivElement>(null);
  const starred = useStore(starredChats);

  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;

    function mouseEnter() {
      setHovering(true);

      if (timeout) {
        clearTimeout(timeout);
      }
    }

    function mouseLeave() {
      setHovering(false);
    }

    hoverRef.current?.addEventListener('mouseenter', mouseEnter);
    hoverRef.current?.addEventListener('mouseleave', mouseLeave);

    return () => {
      hoverRef.current?.removeEventListener('mouseenter', mouseEnter);
      hoverRef.current?.removeEventListener('mouseleave', mouseLeave);
    };
  }, []);

  return (
    <div
      ref={hoverRef}
      className="group rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 overflow-hidden flex justify-between items-center px-2 py-1"
    >
      <a href={`/chat/${item.urlId}`} className="flex w-full relative truncate block" onClick={onNavigate}>
        {item.description}
        <div className="absolute right-0 z-1 top-0 bottom-0 bg-gradient-to-l from-bolt-elements-background-depth-2 group-hover:from-bolt-elements-background-depth-3 to-transparent w-10 flex justify-end group-hover:w-20 group-hover:from-45%">
          {hovering && (
            <div className="flex items-center gap-0.5 pr-1 text-bolt-elements-textSecondary">
              <button
                type="button"
                title={starred.has(item.id) ? 'Remove from starred' : 'Star this chat'}
                aria-label={starred.has(item.id) ? 'Remove from starred' : 'Star this chat'}
                aria-pressed={starred.has(item.id)}
                className={classNames('p-1 rounded transition-colors duration-150', {
                  'text-accent-500': starred.has(item.id),
                  'hover:text-bolt-elements-textPrimary': !starred.has(item.id),
                })}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleStar(item.id);
                }}
              >
                <div className={classNames('scale-110', starred.has(item.id) ? 'i-ph:star-fill' : 'i-ph:star')} />
              </button>

              <Dialog.Trigger asChild>
                <button
                  className="i-ph:trash scale-110 p-1 hover:text-bolt-elements-item-contentDanger"
                  title="Delete chat"
                  aria-label="Delete chat"
                  onClick={(event) => {
                    // we prevent the default so we don't trigger the anchor above
                    event.preventDefault();
                    event.stopPropagation();
                    onDelete?.(event);
                  }}
                />
              </Dialog.Trigger>
            </div>
          )}
        </div>
      </a>
    </div>
  );
}
