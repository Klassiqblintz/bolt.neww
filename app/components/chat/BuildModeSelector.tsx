import { useStore } from '@nanostores/react';
import { BUILD_MODES, buildModeStore, type BuildMode } from '~/lib/stores/buildMode';
import { classNames } from '~/utils/classNames';

const MODE_PLACEHOLDERS: Record<BuildMode, string> = {
  website: 'Describe the website you want to build...',
  slides: 'Describe the slide deck you want to create...',
  app: 'Describe the app you have in mind...',
  prototype: 'Describe the prototype you want to explore...',
};

export function getPlaceholderForMode(mode: BuildMode): string {
  return MODE_PLACEHOLDERS[mode];
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
      </div>
    </section>
  );
}
