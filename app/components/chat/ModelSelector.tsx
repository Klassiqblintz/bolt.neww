import { useStore } from '@nanostores/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { getProviderHeaders, getProviderSpec } from '~/lib/providers/client';
import { PROVIDER_DEFINITIONS, type DiscoveredModel } from '~/lib/providers/types';
import { chatOptionsStore } from '~/lib/stores/buildMode';
import { modelsStore } from '~/lib/stores/models';
import { providersStore } from '~/lib/stores/providers';
import { classNames } from '~/utils/classNames';

interface ModelSelectorProps {
  /**
   * When a user provider is active the models of that provider are shown,
   * otherwise the catalogue of the server is used.
   */
  providerId?: string;
}

/**
 * Dropdown to pick the model used for new messages.
 *
 * The server catalogue is used for the server configured provider. When the
 * user configured a provider, the models are discovered at that provider and
 * the model can also be entered manually for endpoints that do not offer a
 * listing.
 */
export function ModelSelector({ providerId }: ModelSelectorProps) {
  const { models, loaded } = useStore(modelsStore);
  const { providers, defaultProviderId } = useStore(providersStore);
  const { modelId } = useStore(chatOptionsStore);
  const [open, setOpen] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredModel[] | undefined>(undefined);
  const [manualModel, setManualModel] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const activeProvider = providers.find((provider) => provider.id === (providerId ?? defaultProviderId));

  const isUserProvider = !!activeProvider;

  const selected = discovered?.find((model) => model.id === modelId) ?? models.find((model) => model.id === modelId);

  /**
   * Discover the models of the user provider.
   */
  useEffect(() => {
    if (!isUserProvider || !activeProvider) {
      setDiscovered(undefined);

      return undefined;
    }

    let cancelled = false;

    async function discover() {
      try {
        const response = await fetch('/api/providers/models', {
          method: 'POST',
          headers: getProviderHeaders(activeProvider),
          body: JSON.stringify({ provider: getProviderSpec(activeProvider) }),
        });

        const data = (await response.json()) as {
          models?: DiscoveredModel[];
          error?: { message?: string };
        };

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setDiscovered([]);

          toast.error(data.error?.message ?? 'The models could not be loaded.');

          return;
        }

        setDiscovered(data.models ?? []);
      } catch (error) {
        console.error('Failed to discover the models', error);

        if (!cancelled) {
          setDiscovered([]);
        }
      }
    }

    discover();

    return () => {
      cancelled = true;
    };
  }, [isUserProvider, activeProvider?.id, activeProvider?.modelId]);

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

  const list = isUserProvider ? discovered ?? [] : models;

  const definition = activeProvider ? PROVIDER_DEFINITIONS[activeProvider.type] : undefined;

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
        disabled={!loaded && !isUserProvider}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="i-ph:sparkle text-base" />
        <span className="max-w-[140px] truncate">{selected?.label ?? modelId ?? 'Select model'}</span>
        <div className={classNames('i-ph:caret-down text-sm transition-transform', { 'rotate-180': open })} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute bottom-full right-0 mb-2 w-[280px] max-w-[80vw] max-h-[320px] overflow-y-auto rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-xl py-1 z-prompt"
        >
          {isUserProvider && (
            <li className="px-3 py-1.5">
              <input
                type="text"
                value={manualModel}
                placeholder="Or enter a model id"
                className="w-full bg-transparent text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary outline-none border-b border-bolt-elements-borderColor pb-1"
                onChange={(event) => setManualModel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && manualModel.trim()) {
                    chatOptionsStore.setKey('modelId', manualModel.trim());
                    setOpen(false);
                  }
                }}
              />
            </li>
          )}

          {list.length === 0 && (
            <li className="px-3 py-2 text-sm text-bolt-elements-textTertiary">
              {isUserProvider ? 'No models were returned. Enter the model id manually.' : 'No models available'}
            </li>
          )}

          {list.map((model) => (
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
                <span className="flex items-center gap-1.5 shrink-0">
                  {model.isFree && (
                    <span className="rounded-full bg-bolt-elements-item-backgroundAccent px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-bolt-elements-item-contentAccent">
                      Free
                    </span>
                  )}
                  {model.contextLength !== undefined && (
                    <span className="text-[10px] text-bolt-elements-textTertiary">
                      {Math.round(model.contextLength / 1000)}k
                    </span>
                  )}
                  {model.supportsTools !== undefined && (
                    <span
                      className="i-ph:wrench text-[10px] text-bolt-elements-textTertiary"
                      title={model.supportsTools ? 'Supports tool calling' : 'No tool calling'}
                    />
                  )}
                  {model.id === selected?.id && (
                    <div className="i-ph:check-bold text-bolt-elements-item-contentAccent" />
                  )}
                </span>
              </button>
            </li>
          ))}

          {definition && (
            <li className="px-3 py-1.5 text-[11px] text-bolt-elements-textTertiary border-t border-bolt-elements-borderColor mt-1">
              {definition.label}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
