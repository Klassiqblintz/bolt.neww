import { useStore } from '@nanostores/react';
import { useEffect, useRef, useState } from 'react';
import { AVAILABLE_MODELS } from '~/lib/models';
import { chatOptionsStore } from '~/lib/stores/buildMode';
import { classNames } from '~/utils/classNames';

/**
 * Dropdown to pick the Anthropic model used for new messages. The selection is
 * stored in `chatOptionsStore` and sent with each `/api/chat` request, where it
 * is validated against the server-side allow list.
 */
export function ModelSelector() {
  const { modelId } = useStore(chatOptionsStore);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = AVAILABLE_MODELS.find((model) => model.id === modelId) ?? AVAILABLE_MODELS[0];

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function onMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener('mousedown', onMouseDown);

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className={classNames(
          'flex items-center gap-1.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors duration-150 rounded-full px-2.5 py-1.5',
          {
            'text-bolt-elements-textPrimary bg-bolt-elements-item-backgroundActive': open,
          },
        )}
        title="Select model"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="i-ph:sparkle text-base" />
        <span className="max-w-[140px] truncate">{selected.label}</span>
        <div className={classNames('i-ph:caret-down text-sm transition-transform', { 'rotate-180': open })} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute bottom-full right-0 mb-2 w-[220px] max-w-[80vw] rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-xl py-1 z-prompt"
        >
          {AVAILABLE_MODELS.map((model) => (
            <li key={model.id}>
              <button
                type="button"
                role="option"
                aria-selected={model.id === selected.id}
                className={classNames(
                  'flex w-full items-center justify-between px-3 py-2 text-sm text-left transition-colors duration-150',
                  model.id === selected.id
                    ? 'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent'
                    : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary',
                )}
                onClick={() => {
                  chatOptionsStore.setKey('modelId', model.id);
                  setOpen(false);
                }}
              >
                {model.label}
                {model.id === selected.id && <div className="i-ph:check-bold text-bolt-elements-item-contentAccent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
