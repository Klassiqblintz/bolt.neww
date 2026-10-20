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
    <div className="flex flex-wrap items-center justify-center gap-2" role="radiogroup" aria-label="Build mode">
      {BUILD_MODES.map((item) => {
        const active = item.id === mode;

        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={classNames(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm border transition-theme',
              active
                ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-contentAccent'
                : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive',
            )}
            onClick={() => buildModeStore.set(item.id)}
          >
            <div className={classNames(item.icon, 'text-base')} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
