import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';
import { ProviderStatusBanner } from '~/components/header/ProviderStatusBanner';
import { Menu } from '~/components/sidebar/Menu.client';
import { ChatListPage } from '~/components/history/ChatListPage.client';

export const meta: MetaFunction = () => {
  return [{ title: 'Projects · Bolt' }, { name: 'description', content: 'Your saved Bolt conversations' }];
};

export const loader = () => json({});

export default function ProjectsRoute() {
  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <ProviderStatusBanner />
      <ClientOnly fallback={null}>{() => <Menu />}</ClientOnly>
      <div className="flex-1 overflow-y-auto bg-bolt-elements-background-depth-1">
        <ClientOnly fallback={null}>{() => <ChatListPage filter="all" />}</ClientOnly>
      </div>
    </div>
  );
}
