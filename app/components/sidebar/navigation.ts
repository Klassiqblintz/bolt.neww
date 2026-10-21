/**
 * The sidebar navigation model.
 *
 * The destinations are described as data so the sidebar renders one list and
 * the same list can be verified against the requirement: the primary
 * destinations are real routes, none of them is a filter or a placeholder, and
 * every entry has an icon from the installed library.
 */

export interface NavItem {
  label: string;
  icon: string;
  href: string;

  /** Whether the destination counts as active for this pathname. */
  matches?: (pathname: string) => boolean;
}

/** The primary destinations, in the required order. */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Home', icon: 'i-ph:house', href: '/', matches: (path) => path === '/' },
  { label: 'Projects', icon: 'i-ph:folder-notch', href: '/projects', matches: (path) => path === '/projects' },
  { label: 'Starred', icon: 'i-ph:star', href: '/starred', matches: (path) => path === '/starred' },
  {
    label: 'Recently viewed',
    icon: 'i-ph:clock-counter-clockwise',
    href: '/recently-viewed',
    matches: (path) => path === '/recently-viewed',
  },
  { label: 'Live chat', icon: 'i-ph:broadcast', href: '/', matches: (path) => path.startsWith('/chat/') },
];

/** Provider management. */
export const PROVIDER_NAV: NavItem[] = [
  { label: 'AI providers', icon: 'i-ph:plugs', href: '/providers', matches: (path) => path === '/providers' },
];

/** Help, release notes and status. */
export const SECONDARY_NAV: NavItem[] = [
  { label: 'Help center', icon: 'i-ph:question', href: '/help', matches: (path) => path === '/help' },
  {
    label: 'Release notes',
    icon: 'i-ph:lightning',
    href: '/release-notes',
    matches: (path) => path === '/release-notes',
  },
  { label: 'Status', icon: 'i-ph:path', href: '/status', matches: (path) => path === '/status' },
];

/** The chat destination, which depends on the conversation that is open. */
export function getLiveChatHref(currentChatId: string | undefined): string {
  return currentChatId ? `/chat/${currentChatId}` : '/';
}
