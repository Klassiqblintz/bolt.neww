import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';
import { ProviderStatusBanner } from '~/components/header/ProviderStatusBanner';
import { Menu } from '~/components/sidebar/Menu.client';
import { StatusPanel } from '~/components/status/StatusPanel.client';

export const meta: MetaFunction = () => {
  return [{ title: 'Status · Bolt' }, { name: 'description', content: 'Readiness of this Bolt deployment' }];
};

export const loader = () => json({});

export default function StatusRoute() {
  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <ProviderStatusBanner />
      <ClientOnly fallback={null}>{() => <Menu />}</ClientOnly>
      <div className="flex-1 overflow-y-auto bg-bolt-elements-background-depth-1">
        <ClientOnly fallback={null}>{() => <StatusPanel />}</ClientOnly>
      </div>
    </div>
  );
}
