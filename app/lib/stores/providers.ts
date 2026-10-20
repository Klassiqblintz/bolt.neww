import { map } from 'nanostores';
import type { StoredProvider } from '~/lib/providers/types';

export interface ProvidersState {
  /** The providers of this browser. */
  providers: StoredProvider[];

  /** The id of the provider that is used for new requests. */
  defaultProviderId: string | undefined;

  /** Whether the vault has been read. */
  loaded: boolean;
}

export const providersStore = map<ProvidersState>({
  providers: [],
  defaultProviderId: undefined,
  loaded: false,
});
