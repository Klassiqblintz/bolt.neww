import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { ProviderManager } from '~/components/providers/ProviderManager';
import { Header } from '~/components/header/Header';
import { Menu } from '~/components/sidebar/Menu.client';
import { ProviderStatusBanner } from '~/components/header/ProviderStatusBanner';

export const meta: MetaFunction = () => {
  return [{ title: 'AI providers · Bolt' }, { name: 'description', content: 'Manage the AI providers of Bolt' }];
};

export const loader = () => json({});

export default function ProvidersRoute() {
  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <ProviderStatusBanner />
      <ClientOnly fallback={null}>{() => <Menu />}</ClientOnly>
      <div className="flex-1 overflow-y-auto bg-bolt-elements-background-depth-1">
        <ClientOnly fallback={<BaseChat />}>{() => <ProviderManager />}</ClientOnly>
      </div>
    </div>
  );
}
