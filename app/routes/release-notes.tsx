import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';
import { ProviderStatusBanner } from '~/components/header/ProviderStatusBanner';
import { Menu } from '~/components/sidebar/Menu.client';

export const meta: MetaFunction = () => {
  return [{ title: 'Release notes · Bolt' }, { name: 'description', content: 'Release notes of this Bolt deployment' }];
};

export const loader = () => json({});

export default function ReleaseNotesRoute() {
  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <ProviderStatusBanner />
      <ClientOnly fallback={null}>{() => <Menu />}</ClientOnly>
      <div className="flex-1 overflow-y-auto bg-bolt-elements-background-depth-1">
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-2xl font-semibold text-bolt-elements-textPrimary">Release notes</h1>

          <div className="mt-6 rounded-xl border border-dashed border-bolt-elements-borderColor px-5 py-10 text-center">
            <div className="i-ph:scroll text-3xl text-bolt-elements-textTertiary mx-auto" aria-hidden="true" />
            <p className="mt-3 text-sm text-bolt-elements-textSecondary">
              Release notes are not yet published for this deployment.
            </p>
            <p className="mt-1 text-xs text-bolt-elements-textTertiary">
              This page will list the changes of each release once they are recorded.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
