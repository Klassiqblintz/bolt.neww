import { useStore } from '@nanostores/react';
import { useEffect } from 'react';
import { BUILD_MODES, buildModeStore, initBuildMode, setBuildMode } from '~/lib/stores/buildMode';
import { classNames } from '~/utils/classNames';

const MODE_PLACEHOLDERS: Record<string, string> = {
  website: 'Describe the website you want to build...',
  slides: 'Describe the slide deck you want to create...',
  app: 'Describe the app you have in mind...',
  prototype: 'Describe the prototype you want to explore...',
};

/**
 * Describes what the selected mode changes about the generation workflow.
 *
 * All modes run through the same artifact pipeline (files and shell commands
 * executed in the browser), the mode steers what the assistant builds and
 * which example the prompt starts from.
 */
const MODE_DESCRIPTIONS: Record<string, string> = {
  website: 'Bolt will build a responsive website for you.',
  slides: 'Bolt will build a slide deck with navigation for you.',
  app: 'Bolt will build a full application with a working user flow.',
  prototype: 'Bolt will build a quick interactive prototype to explore.',
};

export function getPlaceholderForMode(mode: string): string {
  return MODE_PLACEHOLDERS[mode] ?? MODE_PLACEHOLDERS.app;
}

export function getDescriptionForMode(mode: string): string {
  return MODE_DESCRIPTIONS[mode] ?? MODE_DESCRIPTIONS.app;
}

/**
 * Compact, icon-first build mode selector.
 *
 * The four modes sit in one horizontal row. Every option is a small rounded
 * square icon tile with its label directly underneath, outside of the tile: the
 * icon carries the choice, the label names it. The active mode gets a blue
 * border and an accent tint, the inactive tiles stay clearly visible on their
 * dark blue (dark theme) or light (light theme) surface.
 *
 * The selector stays mounted for the whole conversation, so the mode can still
 * be changed after the first message was sent.
 */
export function BuildModeSelector() {
  const mode = useStore(buildModeStore);

  /**
   * The persisted mode is restored after the first render, so the server
   * rendered markup and the hydrated markup agree.
   */
  useEffect(() => {
    initBuildMode();
  }, []);

  return (
    <section aria-label="Build mode" className="flex flex-col gap-2">
      <span className="text-xs font-medium text-bolt-elements-textSecondary text-center">
        What do you want to build?
      </span>

      <div
        role="radiogroup"
        aria-label="Build mode"
        className="flex flex-nowrap justify-center items-start gap-2 sm:gap-4"
      >
        {BUILD_MODES.map((item) => {
          const active = item.id === mode;

          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={MODE_DESCRIPTIONS[item.id]}
              className={classNames('group flex flex-col items-center gap-1 select-none', {
                'text-bolt-elements-mode-tile-iconActive': active,
                'text-bolt-elements-mode-tile-icon': !active,
              })}
              onClick={() => setBuildMode(item.id)}
            >
              {/**
               * Square icon tile. The label intentionally lives outside of it,
               * underneath, so the four modes read as one balanced row instead
               * of four large cards.
               */}
              <span
                className={classNames(
                  'flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center p-1 rounded-xl border transition-all duration-150',
                  {
                    'border-bolt-elements-mode-tile-borderColorActive bg-bolt-elements-mode-tile-backgroundActive shadow-md shadow-bolt-elements-mode-tile-backgroundActive':
                      active,
                    'border-bolt-elements-mode-tile-borderColor bg-bolt-elements-mode-tile-background hover:bg-bolt-elements-mode-tile-backgroundActive':
                      !active,
                  },
                )}
              >
                <span className={classNames(item.icon, 'text-xl sm:text-2xl')} aria-hidden="true" />
              </span>

              <span className="text-[11px] sm:text-xs font-medium leading-none text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
