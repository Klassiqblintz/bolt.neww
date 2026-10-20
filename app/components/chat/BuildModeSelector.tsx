import { useStore } from '@nanostores/react';
import { BUILD_MODES, buildModeStore, setBuildMode, type BuildMode } from '~/lib/stores/buildMode';
import { classNames } from '~/utils/classNames';

const MODE_PLACEHOLDERS: Record<BuildMode, string> = {
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
const MODE_DESCRIPTIONS: Record<BuildMode, string> = {
  website: 'Bolt will build a responsive website for you.',
  slides: 'Bolt will build a slide deck with navigation for you.',
  app: 'Bolt will build a full application with a working user flow.',
  prototype: 'Bolt will build a quick interactive prototype to explore.',
};

export function getPlaceholderForMode(mode: BuildMode): string {
  return MODE_PLACEHOLDERS[mode];
}

export function getDescriptionForMode(mode: BuildMode): string {
  return MODE_DESCRIPTIONS[mode];
}

/**
 * Compact, icon-first build mode selector.
 *
 * The four modes sit in one horizontal row whenever space permits. Every
 * option is a rounded-square icon tile with its label directly underneath,
 * outside of the tile: the icon carries the choice, the label names it. The
 * active mode gets a blue border, an accent tint and a soft glow, while the
 * inactive tiles stay clearly visible on their dark (dark theme) or light
 * (light theme) surface.
 */
export function BuildModeSelector() {
  const mode = useStore(buildModeStore);

  return (
    <section aria-label="Build mode">
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-bolt-elements-textSecondary text-center">
          What do you want to build?
        </span>

        <div role="radiogroup" aria-label="Build mode" className="flex flex-wrap justify-center gap-4 sm:gap-6">
          {BUILD_MODES.map((item) => {
            const active = item.id === mode;

            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                title={MODE_DESCRIPTIONS[item.id]}
                className={classNames('group flex flex-col items-center gap-1.5 select-none', {
                  'text-bolt-elements-item-contentAccent': active,
                  'text-bolt-elements-textPrimary': !active,
                })}
                onClick={() => setBuildMode(item.id)}
              >
                {/**
                 * Square icon tile. The label intentionally lives outside of
                 * it, underneath, so the four modes read as one balanced row
                 * instead of four large cards.
                 */}
                <span
                  className={classNames(
                    'flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border transition-all duration-150',
                    {
                      'border-bolt-elements-borderColorActive bg-bolt-elements-item-backgroundAccent shadow-md shadow-bolt-elements-item-backgroundAccent':
                        active,
                      'border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 group-hover:bg-bolt-elements-background-depth-3':
                        !active,
                    },
                  )}
                >
                  <span className={classNames(item.icon, 'text-2xl sm:text-3xl')} aria-hidden="true" />
                </span>

                <span className="text-xs sm:text-sm font-medium leading-none text-center">{item.label}</span>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-bolt-elements-textTertiary">{getDescriptionForMode(mode)}</p>
      </div>
    </section>
  );
}
