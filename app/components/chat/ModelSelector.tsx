import { useStore } from '@nanostores/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { getProviderHeaders, getProviderSpec } from '~/lib/providers/client';
import { PROVIDER_DEFINITIONS, type DiscoveredModel } from '~/lib/providers/types';
import { chatOptionsStore } from '~/lib/stores/buildMode';
import { modelsStore } from '~/lib/stores/models';
import { providersStore } from '~/lib/stores/providers';
import { selectModel as persistModelSelection } from '~/lib/stores/selection';
import { classNames } from '~/utils/classNames';

interface ModelSelectorProps {
  /**
   * When a user provider is active the models of that provider are shown,
   * otherwise the catalogue of the server is used.
   */
  providerId?: string;
}

const DROPDOWN_WIDTH = 320;
const DROPDOWN_MAX_HEIGHT = 340;
const VIEWPORT_MARGIN = 8;
const Z_INDEX = 1000;

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * Dropdown to pick the model used for new messages.
 *
 * The list is rendered through a portal into `document.body` so it is never
 * clipped by the composer's `overflow: hidden`, the sidebar or the workbench
 * stacking contexts. It opens above the trigger when there is room and below
 * otherwise, stays inside the viewport, and closes on selection, outside click
 * or Escape.
 */
export function ModelSelector({ providerId }: ModelSelectorProps) {
  const { models, defaultModelId, loaded, unavailableModelId } = useStore(modelsStore);
  const { providers, defaultProviderId } = useStore(providersStore);
  const { modelId } = useStore(chatOptionsStore);

  const [open, setOpen] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredModel[] | undefined>(undefined);
  const [manualModel, setManualModel] = useState('');
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<DropdownPosition | undefined>(undefined);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const activeProvider = providers.find((provider) => provider.id === (providerId ?? defaultProviderId));
  const isUserProvider = !!activeProvider;

  /**
   * The model that is effectively selected. The composer selection wins, then
   * the provider default, then the server default. The store value itself is
   * only written when the user makes an explicit choice.
   */
  const effectiveModelId = modelId ?? (isUserProvider ? activeProvider?.modelId : defaultModelId);

  const definition = activeProvider ? PROVIDER_DEFINITIONS[activeProvider.type] : undefined;

  const list = useMemo(() => {
    const source = isUserProvider ? discovered ?? [] : models;
    const query = search.trim().toLowerCase();

    if (!query) {
      return source;
    }

    return source.filter(
      (model) => model.label.toLowerCase().includes(query) || model.id.toLowerCase().includes(query),
    );
  }, [discovered, isUserProvider, models, search]);

  const selected = list.find((model) => model.id === effectiveModelId);

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

  const close = () => {
    setOpen(false);
    setSearch('');
    setManualModel('');
    setActiveIndex(0);
  };

  const selectModel = (id: string) => {
    /**
     * The choice is stored together with the provider it belongs to, so it
     * survives a reload and can never be replayed against another provider.
     */
    persistModelSelection(id.trim());
    modelsStore.setKey('unavailableModelId', undefined);
    close();
  };

  const computePosition = () => {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const width = Math.min(DROPDOWN_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);

    const availableAbove = rect.top - VIEWPORT_MARGIN;
    const availableBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const openAbove = availableAbove > availableBelow;

    const next: DropdownPosition = {
      left: Math.max(VIEWPORT_MARGIN, Math.min(rect.right - width, window.innerWidth - width - VIEWPORT_MARGIN)),
      width,
      maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, openAbove ? availableAbove : availableBelow),
    };

    if (openAbove) {
      next.bottom = window.innerHeight - rect.top + VIEWPORT_MARGIN;
    } else {
      next.top = rect.bottom + VIEWPORT_MARGIN;
    }

    setPosition(next);
  };

  const toggle = () => {
    if (open) {
      close();

      return;
    }

    setOpen(true);
    setSearch('');
    setActiveIndex(0);
    computePosition();
  };

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node;

      const insideTrigger = containerRef.current?.contains(target);
      const insideList = listRef.current?.contains(target);

      if (!insideTrigger && !insideList) {
        close();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    }

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, Math.min(index + 1, list.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();

      const model = list[activeIndex];

      if (model) {
        selectModel(model.id);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={classNames(
          'flex items-center gap-1.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors duration-150 rounded-lg px-2.5 py-1.5',
          {
            'text-bolt-elements-textPrimary bg-bolt-elements-item-backgroundActive': open,
          },
        )}
        title={selected?.label ?? effectiveModelId ?? 'Select model'}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={!loaded && !isUserProvider}
        onClick={toggle}
      >
        <div className="i-ph:sparkle text-base" />
        <span className="max-w-[140px] truncate">{selected?.label ?? effectiveModelId ?? 'Select model'}</span>
        {effectiveModelId !== undefined && effectiveModelId === unavailableModelId && (
          <div
            className="i-ph:warning-circle-bold text-bolt-elements-icon-error"
            title="This saved model is not available for the configured provider. Pick another model."
          />
        )}
        <div className={classNames('i-ph:caret-down text-sm transition-transform', { 'rotate-180': open })} />
      </button>

      {open &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            aria-label="AI models"
            className="fixed overflow-hidden rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-2xl shadow-bolt-elements-sidebar-dropdownShadow flex flex-col"
            style={{
              top: position?.top,
              bottom: position?.bottom,
              left: position?.left,
              width: position?.width,
              maxHeight: position?.maxHeight,
              zIndex: Z_INDEX,
            }}
            onKeyDown={handleListKeyDown}
          >
            <li className="px-3 py-2 border-b border-bolt-elements-borderColor shrink-0">
              <div className="relative">
                <div className="i-ph:magnifying-glass absolute left-0 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary" />
                <input
                  type="text"
                  value={search}
                  placeholder="Search models"
                  aria-label="Search models"
                  autoFocus
                  className="w-full bg-transparent text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary outline-none pl-5"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setActiveIndex(0);
                  }}
                />
              </div>
            </li>

            {isUserProvider && (
              <li className="px-3 py-2 border-b border-bolt-elements-borderColor shrink-0">
                <input
                  type="text"
                  value={manualModel}
                  placeholder="Or enter a model id"
                  aria-label="Enter a model id"
                  className="w-full bg-transparent text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary outline-none"
                  onChange={(event) => setManualModel(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();

                    if (event.key === 'Enter' && manualModel.trim()) {
                      selectModel(manualModel.trim());
                    }
                  }}
                />
              </li>
            )}

            <li className="flex-1 min-h-0 overflow-y-auto py-1">
              {isUserProvider && discovered === undefined && (
                <p className="px-3 py-2 text-sm text-bolt-elements-textTertiary">Loading models…</p>
              )}

              {list.length === 0 && discovered !== undefined && (
                <p className="px-3 py-2 text-sm text-bolt-elements-textTertiary">
                  {isUserProvider ? 'No models were returned. Enter the model id manually.' : 'No models available'}
                </p>
              )}

              {list.map((model, index) => {
                const isSelected = model.id === effectiveModelId;
                const isActive = index === activeIndex;
                const isUnavailable = model.id === unavailableModelId;

                return (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={classNames(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors duration-150',
                      isSelected
                        ? 'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent'
                        : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary',
                      { 'bg-bolt-elements-item-backgroundActive': isActive && !isSelected },
                    )}
                    onClick={() => selectModel(model.id)}
                  >
                    <span className="truncate text-left" title={model.id}>
                      {model.label}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {isUnavailable && (
                        <span
                          className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-[10px]"
                          title="Not available for the configured provider"
                        />
                      )}
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
                      {isSelected && <div className="i-ph:check-bold text-bolt-elements-item-contentAccent" />}
                    </span>
                  </button>
                );
              })}
            </li>

            {definition && (
              <li className="px-3 py-2 text-[11px] text-bolt-elements-textTertiary border-t border-bolt-elements-borderColor shrink-0">
                {definition.label}
              </li>
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
