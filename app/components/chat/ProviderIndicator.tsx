import { useStore } from '@nanostores/react';
import { PROVIDER_DEFINITIONS } from '~/lib/providers/types';
import { providersStore } from '~/lib/stores/providers';

/**
 * Shows which provider a new request will use.
 *
 * A user provider is never silently replaced by the server default, so the
 * source of the configuration is always visible.
 */
export function ProviderIndicator() {
  const { providers, defaultProviderId } = useStore(providersStore);

  const active = providers.find((provider) => provider.id === defaultProviderId) ?? providers[0];

  if (!active) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-bolt-elements-textTertiary px-2 py-1.5"
        title="Requests use the provider that is configured on the server."
      >
        <div className="i-ph:hard-drive text-base" />
        <span className="hidden sm:inline">Server default</span>
      </div>
    );
  }

  const definition = PROVIDER_DEFINITIONS[active.type];

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-bolt-elements-item-contentAccent px-2 py-1.5"
      title={`Requests use your provider "${active.name}" (${definition.label}).`}
    >
      <div className="i-ph:plugs text-base" />
      <span className="hidden sm:inline max-w-[120px] truncate">{active.name}</span>
    </div>
  );
}
