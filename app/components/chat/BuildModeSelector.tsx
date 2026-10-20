import { useStore } from '@nanostores/react';
import { BUILD_MODES, buildModeStore, type BuildMode } from '~/lib/stores/buildMode';
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
 * Build-mode chips below the homepage composer. The selection is stored in
 * `buildModeStore` and injected as extra context into the first message so it
 * actually influences what the assistant builds.
 */
export function BuildModeSelector() {
  const mode = useStore(buildModeStore);

  return (
    <section aria-label="Build mode">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-3">
        <span className="hidden sm:block text-sm text-bolt-elements-textTertiary shrink-0">Build</span>

        <div
          role="radiogroup"
          aria-label="Build mode"
          className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 p-1 rounded-full border border-bolt-elements-borderColor bg-bolt-elements-surface-card"
        >
          {BUILD_MODES.map((item) => {
            const active = item.id === mode;

            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={classNames(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all duration-150',
                  {
                    'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent shadow-sm': active,
                    'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive':
                      !active,
                  },
                )}
                onClick={() => buildModeStore.set(item.id)}
              >
                <div className={classNames(item.icon, 'text-base shrink-0')} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-center text-xs text-bolt-elements-textTertiary">{getDescriptionForMode(mode)}</p>
      </div>
    </section>
  );
}
