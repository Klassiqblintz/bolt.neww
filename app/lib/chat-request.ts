/**
 * The body of a chat request.
 *
 * It lives apart from the component so the contract between the composer and
 * `/api/chat` can be tested without mounting React: what reaches the server is
 * what this function returns, and a change here changes the payload directly.
 *
 * No credential is ever part of this body. The API key of a user provider
 * travels in its own header.
 */

import { DEFAULT_BUILD_MODE, isBuildMode, type BuildMode } from '~/lib/buildModes';
import type { ProviderRequestSpec } from '~/lib/providers/types';

export interface ChatRequestBody {
  /** The model the user selected, or `undefined` for the provider default. */
  modelId: string | undefined;

  /** The provider the request should be sent to. */
  provider: ProviderRequestSpec | undefined;

  /** The build mode that steers the generation. */
  buildMode: BuildMode;

  /** Whether the assistant should plan before it builds. */
  planningMode: boolean;
}

export interface ChatRequestInput {
  modelId?: string | undefined;
  provider?: ProviderRequestSpec | undefined;
  buildMode?: string | undefined;
  planningMode?: boolean | undefined;
}

/**
 * Builds the body that is posted to `/api/chat`.
 *
 * The build mode is validated here as well: an unknown value would reach the
 * server, where it silently falls back to the default. Sending a known value
 * keeps the client and the server in agreement about what was requested.
 */
export function buildChatRequestBody({
  modelId,
  provider,
  buildMode,
  planningMode,
}: ChatRequestInput): ChatRequestBody {
  return {
    modelId,
    provider,
    buildMode: isBuildMode(buildMode) ? buildMode : DEFAULT_BUILD_MODE,
    planningMode: planningMode === true,
  };
}
