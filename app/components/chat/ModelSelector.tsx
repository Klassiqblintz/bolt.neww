import { useStore } from '@nanostores/react';
import { useEffect, useRef, useState } from 'react';
import { chatOptionsStore } from '~/lib/stores/buildMode';
import { modelsStore } from '~/lib/stores/models';
import { classNames } from '~/utils/classNames';

/**
 * Dropdown to pick the model used for new messages.
 *
 * The list comes from the server, which only offers the models of the
 * configured provider that the application can use. The selection is stored in
 * `chatOptionsStore` and sent with each `/api/chat` request, where it is
 * validated against the same catalogue.
 */
export function ModelSelector() {
  const { models, defaultModelId, loaded } = useStore(modelsStore);
  const { modelId } = useStore(chatOptionsStore);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = models.find((model) => model.id === modelId) ?? models.find((m) => m.id === defaultModelId);

  useEffect(() => {
    if (loaded && defaultModelId && !models.some((model) => model.id === modelId)) {
      chatOptionsStore.setKey('modelId', defaultModelId);
    }
  }, [loaded, defaultModelId, modelId, models]);

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

  if (loaded && models.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-bolt-elements-textTertiary px-2 py-1.5">
        <div className="i-ph:warning-circle-bold text-base" />
        No models available
      </div>
    );
  }

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
        disabled={!loaded}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="i-ph:sparkle text-base" />
        <span className="max-w-[140px] truncate">{selected?.label ?? 'Select model'}</span>
        <div className={classNames('i-ph:caret-down text-sm transition-transform', { 'rotate-180': open })} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute bottom-full right-0 mb-2 w-[240px] max-w-[80vw] rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-xl py-1 z-prompt"
        >
          {models.map((model) => (
            <li key={model.id}>
              <button
                type="button"
                role="option"
                aria-selected={model.id === selected?.id}
                className={classNames(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors duration-150',
                  model.id === selected?.id
                    ? 'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent'
                    : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary',
                )}
                onClick={() => {
                  chatOptionsStore.setKey('modelId', model.id);
                  setOpen(false);
                }}
              >
                <span className="truncate">{model.label}</span>
                {model.id === selected?.id && <div className="i-ph:check-bold text-bolt-elements-item-contentAccent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
