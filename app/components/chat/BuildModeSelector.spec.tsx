// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuildModeSelector, getDescriptionForMode, getPlaceholderForMode } from '~/components/chat/BuildModeSelector';
import { BUILD_MODES, buildModeStore } from '~/lib/stores/buildMode';

/** A localStorage stand-in so a mounted selector never touches the real one. */
function stubLocalStorage() {
  const data: Record<string, string> = {};

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => (key in data ? data[key] : null),
      setItem: (key: string, value: string) => {
        data[key] = value;
      },
      removeItem: (key: string) => {
        delete data[key];
      },
    },
  });
}

beforeEach(() => {
  stubLocalStorage();

  /**
   * The selector restores the persisted mode after mount, so the store is put
   * back to the default to keep each test independent.
   */
  buildModeStore.set('app');
});

describe('BuildModeSelector', () => {
  it('renders exactly the four required modes', () => {
    render(<BuildModeSelector />);

    const group = screen.getByRole('radiogroup', { name: 'Build mode' });
    const options = within(group).getAllByRole('radio');

    expect(options).toHaveLength(4);
    expect(options.map((option) => option.textContent)).toEqual(['Website', 'Slides', 'App', 'Prototype']);
  });

  it('puts every label outside of the icon tile', () => {
    render(<BuildModeSelector />);

    for (const mode of BUILD_MODES) {
      const option = screen.getByRole('radio', { name: mode.label });

      /** The tile is the first span, the label is a sibling of the tile. */
      const tile = option.querySelector('span');

      expect(tile).not.toBeNull();
      expect(tile?.textContent).not.toContain(mode.label);
      expect(option.textContent).toContain(mode.label);
    }
  });

  it('uses the required icon for each mode', () => {
    render(<BuildModeSelector />);

    for (const mode of BUILD_MODES) {
      const option = screen.getByRole('radio', { name: mode.label });
      const icon = option.querySelector(`.${mode.icon.replace(/:/g, '\\:')}`);

      expect(icon).not.toBeNull();
    }
  });

  it('marks the selected mode as checked', () => {
    render(<BuildModeSelector />);

    expect(screen.getByRole('radio', { name: 'App' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Website' })).not.toBeChecked();
  });

  it('changes the selected mode on a click', async () => {
    const user = userEvent.setup();

    render(<BuildModeSelector />);

    await user.click(screen.getByRole('radio', { name: 'Slides' }));

    expect(buildModeStore.get()).toBe('slides');
    expect(screen.getByRole('radio', { name: 'Slides' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'App' })).not.toBeChecked();
  });

  it('keeps the choice when the user types after selecting', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <BuildModeSelector />
        <textarea aria-label="Prompt" />
      </div>,
    );

    await user.click(screen.getByRole('radio', { name: 'Prototype' }));
    await user.type(screen.getByLabelText('Prompt'), 'a dashboard');

    expect(buildModeStore.get()).toBe('prototype');
    expect(screen.getByRole('radio', { name: 'Prototype' })).toBeChecked();
  });

  it('persists the choice so it survives a remount', async () => {
    const user = userEvent.setup();

    const first = render(<BuildModeSelector />);

    await user.click(screen.getByRole('radio', { name: 'Website' }));

    first.unmount();

    /** A remount re-reads the persisted mode, which models a reload. */
    buildModeStore.set('app');

    render(<BuildModeSelector />);

    expect(screen.getByRole('radio', { name: 'Website' })).toBeChecked();
  });

  it('exposes a description for each mode', () => {
    for (const mode of BUILD_MODES) {
      expect(getDescriptionForMode(mode.id)).toBeTruthy();
      expect(getPlaceholderForMode(mode.id)).toBeTruthy();
    }
  });

  it('falls back to the app copy for an unknown mode', () => {
    expect(getPlaceholderForMode('hologram')).toBe(getPlaceholderForMode('app'));
    expect(getDescriptionForMode('hologram')).toBe(getDescriptionForMode('app'));
  });

  it('never writes to the console while rendering', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      render(<BuildModeSelector />);

      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
