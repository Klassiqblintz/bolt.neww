import { useProviderStatus } from '~/lib/hooks';

/**
 * Warns the user when the AI provider is not configured on the server.
 *
 * The banner is only rendered in that case, so the normal interface is
 * unchanged.
 */
export function ProviderStatusBanner() {
  const status = useProviderStatus();

  if (!status || status.configured) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-start gap-2 px-4 sm:px-6 py-2.5 text-sm text-bolt-elements-button-danger-text bg-bolt-elements-button-danger-background border-b border-bolt-elements-borderColor"
    >
      <div className="i-ph:warning-circle-bold text-base shrink-0 mt-px" />
      <span>
        The AI provider is not configured, so code generation is unavailable. Add{' '}
        <code className="kdb">{status.apiKeyEnvName}</code> to the server environment to enable it.
      </span>
    </div>
  );
}
