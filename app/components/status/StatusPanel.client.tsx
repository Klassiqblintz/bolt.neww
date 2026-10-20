import { useEffect, useState } from 'react';
import { loadProviders } from '~/lib/providers/client';
import { useProviderStatus } from '~/lib/hooks';
import { classNames } from '~/utils/classNames';

interface VaultState {
  available: boolean;
  count: number;
}

/**
 * Shows the real readiness of this deployment: what the server reports about
 * its AI provider, how many user providers exist in this browser and whether
 * the local persistence is available. It never invents uptime or successful
 * checks.
 */
export function StatusPanel() {
  const status = useProviderStatus();
  const [vault, setVault] = useState<VaultState | undefined>(undefined);
  const [persistence, setPersistence] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    loadProviders()
      .then((list) => setVault({ available: true, count: list.length }))
      .catch(() => setVault({ available: false, count: 0 }));

    setPersistence(typeof indexedDB !== 'undefined');
  }, []);

  const rows: Array<{ label: string; state: 'ok' | 'warn' | 'unknown'; detail: string }> = [
    {
      label: 'Server AI provider',
      state: status === undefined ? 'unknown' : status.configured ? 'ok' : 'warn',
      detail:
        status === undefined
          ? 'Checking…'
          : status.configured
            ? `Configured (${status.provider}, key: ${status.apiKeyEnvName})`
            : `Not configured — add ${status.apiKeyEnvName} to the server environment`,
    },
    {
      label: 'User providers in this browser',
      state: vault === undefined ? 'unknown' : vault.available && vault.count > 0 ? 'ok' : 'unknown',
      detail:
        vault === undefined
          ? 'Checking…'
          : vault.available
            ? `${vault.count} connected`
            : 'The encrypted vault is unavailable in this browser',
    },
    {
      label: 'Chat history',
      state: persistence === undefined ? 'unknown' : persistence ? 'ok' : 'warn',
      detail:
        persistence === undefined ? 'Checking…' : persistence ? 'Available (IndexedDB)' : 'Unavailable in this browser',
    },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-semibold text-bolt-elements-textPrimary">Status</h1>
      <p className="mt-1 text-sm text-bolt-elements-textSecondary">
        The readiness of this deployment, read from the server and this browser.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-start gap-3 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-4 py-3"
          >
            <span
              className={classNames('mt-0.5 shrink-0', {
                'i-ph:circle-fill text-bolt-elements-icon-success': row.state === 'ok',
                'i-ph:warning-circle-bold text-bolt-elements-icon-error': row.state === 'warn',
                'i-ph:circle-dashed text-bolt-elements-textTertiary': row.state === 'unknown',
              })}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-bolt-elements-textPrimary">{row.label}</div>
              <div className="mt-0.5 text-xs text-bolt-elements-textSecondary break-words">{row.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-bolt-elements-textTertiary">
        No uptime or provider statistics are collected by this deployment, so none are shown here.
      </p>
    </div>
  );
}
