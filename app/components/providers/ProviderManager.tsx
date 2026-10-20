import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { addProvider, loadProviders, removeProvider, setDefaultProvider, updateProvider } from '~/lib/providers/client';
import { PROVIDER_DEFINITIONS, PROVIDER_TYPES, type ProviderType, type StoredProvider } from '~/lib/providers/types';
import { providersStore } from '~/lib/stores/providers';
import { classNames } from '~/utils/classNames';

type TestState = 'idle' | 'testing' | 'ok' | 'failed';

interface FormState {
  type: ProviderType;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

const emptyForm: FormState = {
  type: 'openrouter',
  name: '',
  baseUrl: '',
  apiKey: '',
  modelId: '',
};

/**
 * The provider management of the user.
 *
 * The API keys are encrypted before they are stored and they only live in this
 * browser. The application has no account system, so the browser profile is
 * the boundary the credentials belong to.
 */
export function ProviderManager() {
  const { providers, defaultProviderId, loaded } = useStore(providersStore);

  const [editing, setEditing] = useState<StoredProvider | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [testState, setTestState] = useState<TestState>('idle');
  const [testMessage, setTestMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadProviders().catch((error) => console.error('Failed to load the providers', error));
  }, []);

  const definition = PROVIDER_DEFINITIONS[form.type];

  const openAdd = () => {
    setAdding(true);
    setEditing(undefined);
    setForm(emptyForm);
    setTestState('idle');
    setTestMessage(undefined);
  };

  const openEdit = (provider: StoredProvider) => {
    setEditing(provider);
    setAdding(false);
    setForm({
      type: provider.type,
      name: provider.name,
      baseUrl: provider.baseUrl ?? '',
      apiKey: '',
      modelId: provider.modelId ?? '',
    });
    setTestState(provider.lastTestOk === undefined ? 'idle' : provider.lastTestOk ? 'ok' : 'failed');
    setTestMessage(provider.lastTestMessage);
  };

  const close = () => {
    setAdding(false);
    setEditing(undefined);
    setForm(emptyForm);
    setTestState('idle');
    setTestMessage(undefined);
  };

  /**
   * Tests the connection by asking the provider for its models.
   */
  const testConnection = async (candidate: FormState) => {
    setTestState('testing');
    setTestMessage(undefined);

    try {
      const response = await fetch('/api/providers/models', {
        method: 'POST',
        headers: candidate.apiKey ? { 'x-bolt-provider-key': candidate.apiKey } : {},
        body: JSON.stringify({
          provider: {
            type: candidate.type,
            baseUrl: candidate.baseUrl.trim() || undefined,
            modelId: candidate.modelId.trim() || undefined,
          },
        }),
      });

      const data = (await response.json()) as { models?: unknown[]; error?: { message?: string } };

      if (!response.ok) {
        setTestState('failed');
        setTestMessage(data.error?.message ?? 'The connection failed.');

        return false;
      }

      const count = data.models?.length ?? 0;

      setTestState('ok');
      setTestMessage(
        count > 0 ? `Connection successful, ${count} models available.` : 'Connection successful, no models reported.',
      );

      return true;
    } catch (error) {
      console.error('The connection test failed', error);

      setTestState('failed');
      setTestMessage('The provider could not be reached.');

      return false;
    }
  };

  const save = async () => {
    try {
      if (editing) {
        await updateProvider(editing.id, {
          type: form.type,
          name: form.name,
          baseUrl: form.baseUrl,
          modelId: form.modelId,
          ...(form.apiKey ? { apiKey: form.apiKey } : {}),
        });

        toast.success('The provider was updated.');
      } else {
        if (!form.apiKey) {
          toast.error('An API key is required.');

          return;
        }

        await addProvider({
          type: form.type,
          name: form.name,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          modelId: form.modelId,
        });

        toast.success('The provider was added.');
      }

      close();
    } catch (error) {
      console.error('Failed to save the provider', error);
      toast.error('The provider could not be saved.');
    }
  };

  const disconnect = async (provider: StoredProvider) => {
    try {
      await removeProvider(provider.id);

      toast.success(`${provider.name} was disconnected.`);
    } catch (error) {
      console.error('Failed to remove the provider', error);
      toast.error('The provider could not be removed.');
    }
  };

  const makeDefault = async (provider: StoredProvider) => {
    await setDefaultProvider(provider.id);

    toast.success(`${provider.name} is now your default provider.`);
  };

  const showForm = adding || editing;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-bolt-elements-textPrimary mb-2">AI providers</h1>
        <p className="text-bolt-elements-textSecondary text-sm">
          Connect your own AI provider and model. Your API key is encrypted and stored in this browser only, it is never
          sent to our database and never written to a log.
        </p>
      </header>

      <div className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-surface-card p-4 mb-6">
        <div className="flex items-start gap-2 text-sm text-bolt-elements-textSecondary">
          <div className="i-ph:info text-base shrink-0 mt-px" />
          <p>
            This application has no account system. Credentials are bound to this browser profile, they are not shared
            with other users and they are removed when you clear the site data. Anyone with access to this browser
            profile can use them.
          </p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 sm:p-5 mb-6">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">
            {editing ? `Edit ${editing.name}` : 'Add a provider'}
          </h2>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-bolt-elements-textSecondary mb-1.5" htmlFor="provider-type">
                Provider type
              </label>
              <select
                id="provider-type"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as ProviderType })}
                className="w-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary focus:outline-none focus:border-bolt-elements-borderColorActive"
              >
                {PROVIDER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PROVIDER_DEFINITIONS[type].label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-bolt-elements-textTertiary">{definition.description}</p>
            </div>

            <div>
              <label className="block text-sm text-bolt-elements-textSecondary mb-1.5" htmlFor="provider-name">
                Name
              </label>
              <input
                id="provider-name"
                type="text"
                value={form.name}
                placeholder="My provider"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-bolt-elements-borderColorActive"
              />
            </div>

            <div>
              <label className="block text-sm text-bolt-elements-textSecondary mb-1.5" htmlFor="provider-key">
                API key
              </label>
              <input
                id="provider-key"
                type="password"
                value={form.apiKey}
                placeholder={editing ? 'Leave empty to keep the current key' : definition.keyHint}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                className="w-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-bolt-elements-borderColorActive"
              />
              <p className="mt-1.5 text-xs text-bolt-elements-textTertiary">
                The key is encrypted with AES-GCM before it is stored and is only decrypted in memory when a request is
                sent.
              </p>
            </div>

            <div>
              <label className="block text-sm text-bolt-elements-textSecondary mb-1.5" htmlFor="provider-base-url">
                Endpoint
              </label>
              <input
                id="provider-base-url"
                type="text"
                value={form.baseUrl}
                placeholder={definition.defaultBaseUrl ?? 'https://api.example.com/v1'}
                spellCheck={false}
                disabled={!definition.supportsBaseUrl}
                onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
                className="w-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-bolt-elements-borderColorActive disabled:opacity-50"
              />
              <p className="mt-1.5 text-xs text-bolt-elements-textTertiary">
                {definition.supportsBaseUrl
                  ? 'Only public https endpoints are allowed, they have to speak the OpenAI chat completions API.'
                  : 'This provider uses a fixed endpoint.'}
              </p>
            </div>

            <div>
              <label className="block text-sm text-bolt-elements-textSecondary mb-1.5" htmlFor="provider-model">
                Model
              </label>
              <input
                id="provider-model"
                type="text"
                value={form.modelId}
                placeholder="Leave empty to choose the model later"
                spellCheck={false}
                onChange={(event) => setForm({ ...form, modelId: event.target.value })}
                className="w-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-bolt-elements-borderColorActive"
              />
            </div>

            {testMessage && (
              <div
                className={classNames(
                  'flex items-start gap-2 text-sm',
                  testState === 'ok' ? 'text-bolt-elements-icon-success' : 'text-bolt-elements-icon-error',
                )}
              >
                <div
                  className={classNames(
                    'shrink-0 mt-px',
                    testState === 'ok' ? 'i-ph:check-circle-bold' : 'i-ph:warning-circle-bold',
                  )}
                />
                <span>{testMessage}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text transition-colors disabled:opacity-50"
                disabled={testState === 'testing'}
                onClick={() => testConnection(form)}
              >
                {testState === 'testing' ? 'Testing…' : 'Test connection'}
              </button>
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm bg-accent-500 text-white hover:brightness-110 transition-all"
                onClick={save}
              >
                {editing ? 'Save changes' : 'Add provider'}
              </button>
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                onClick={close}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-bolt-elements-textSecondary">
          {loaded && providers.length === 0 ? 'No providers yet' : 'Your providers'}
        </h2>
        {!showForm && (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm bg-accent-500 text-white hover:brightness-110 transition-all"
            onClick={openAdd}
          >
            <div className="i-ph:plus text-base" />
            Add provider
          </button>
        )}
      </div>

      {loaded && providers.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-bolt-elements-borderColor px-4 py-8 text-center">
          <div className="i-ph:plugs text-2xl text-bolt-elements-textTertiary mb-2" />
          <p className="text-sm text-bolt-elements-textSecondary">No provider is configured yet</p>
          <p className="text-xs text-bolt-elements-textTertiary mt-1">
            Without a provider the server configured one is used.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {providers.map((provider) => (
          <li
            key={provider.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-surface-card px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-bolt-elements-textPrimary truncate">{provider.name}</span>
                <span className="rounded-full bg-bolt-elements-item-backgroundActive px-2 py-0.5 text-[10px] uppercase tracking-wide text-bolt-elements-textSecondary">
                  {PROVIDER_DEFINITIONS[provider.type].label}
                </span>
                {provider.id === defaultProviderId && (
                  <span className="rounded-full bg-bolt-elements-item-backgroundAccent px-2 py-0.5 text-[10px] uppercase tracking-wide text-bolt-elements-item-contentAccent">
                    Default
                  </span>
                )}
              </div>
              <p className="text-xs text-bolt-elements-textTertiary mt-0.5 truncate">
                {provider.modelId ?? 'No model selected'}
                {provider.baseUrl ? ` · ${provider.baseUrl}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {provider.id !== defaultProviderId && (
                <button
                  type="button"
                  title="Use as default"
                  className="rounded-md p-1.5 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-colors"
                  onClick={() => makeDefault(provider)}
                >
                  <div className="i-ph:star text-base" />
                </button>
              )}
              <button
                type="button"
                title="Edit"
                className="rounded-md p-1.5 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-colors"
                onClick={() => openEdit(provider)}
              >
                <div className="i-ph:pencil-simple text-base" />
              </button>
              <button
                type="button"
                title="Disconnect"
                className="rounded-md p-1.5 text-bolt-elements-textSecondary hover:text-bolt-elements-icon-error hover:bg-bolt-elements-item-backgroundDanger transition-colors"
                onClick={() => disconnect(provider)}
              >
                <div className="i-ph:trash text-base" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
