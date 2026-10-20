import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { menuOpenStore } from '~/lib/stores/menu';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';

const NAV_LINKS = [
  { label: 'Docs', href: 'https://github.com/stackblitz/bolt.new#readme', external: true },
  { label: 'GitHub', href: 'https://github.com/stackblitz/bolt.new', external: true },
];

export function Header() {
  const chat = useStore(chatStore);
  const menuOpen = useStore(menuOpenStore);

  return (
    <header
      className={classNames(
        'flex items-center bg-bolt-elements-background-depth-1 px-3 sm:px-5 border-b h-[var(--header-height)] shrink-0',
        {
          'border-transparent': !chat.started,
          'border-bolt-elements-borderColor': chat.started,
        },
      )}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary">
        <button
          type="button"
          className="flex items-center justify-center rounded-md p-1.5 text-bolt-elements-textSecondary transition-colors duration-150 hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive"
          title={menuOpen ? 'Close history' : 'Open history'}
          aria-label={menuOpen ? 'Close history' : 'Open history'}
          aria-expanded={menuOpen}
          aria-controls="side-menu"
          onClick={() => menuOpenStore.set(!menuOpen)}
        >
          <div className="i-ph:sidebar-simple-duotone text-xl" />
        </button>
        <a
          href="/"
          className="text-2xl font-semibold text-accent flex items-center rounded-md transition-opacity duration-150 hover:opacity-80"
          aria-label="Bolt home"
        >
          <span className="i-bolt:logo-text?mask w-[46px] inline-block" />
        </a>
      </div>

      <span className="flex-1 px-2 sm:px-4 truncate text-center text-bolt-elements-textPrimary text-sm sm:text-base font-medium">
        <ClientOnly>{() => <ChatDescription />}</ClientOnly>
      </span>

      <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Main">
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target={link.external ? '_blank' : undefined}
            rel={link.external ? 'noreferrer' : undefined}
            className="hidden sm:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors duration-150"
          >
            {link.label}
            {link.external && <div className="i-ph:arrow-square-out text-sm opacity-60" />}
          </a>
        ))}

        <div className="w-px h-5 mx-1 bg-bolt-elements-borderColor hidden sm:block" />

        <ThemeSwitch className="text-bolt-elements-textSecondary" />

        {chat.started && (
          <ClientOnly>
            {() => (
              <div className="ml-1">
                <HeaderActionButtons />
              </div>
            )}
          </ClientOnly>
        )}
      </nav>
    </header>
  );
}
