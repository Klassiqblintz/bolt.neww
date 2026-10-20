import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
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

  return (
    <header
      className={classNames(
        'flex items-center bg-bolt-elements-background-depth-1 p-4 sm:p-5 border-b h-[var(--header-height)]',
        {
          'border-transparent': !chat.started,
          'border-bolt-elements-borderColor': chat.started,
        },
      )}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <a href="/" className="text-2xl font-semibold text-accent flex items-center" aria-label="Bolt home">
          <span className="i-bolt:logo-text?mask w-[46px] inline-block" />
        </a>
      </div>
      <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
        <ClientOnly>{() => <ChatDescription />}</ClientOnly>
      </span>
      <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target={link.external ? '_blank' : undefined}
            rel={link.external ? 'noreferrer' : undefined}
            className="hidden sm:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-theme"
          >
            {link.label}
          </a>
        ))}
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
