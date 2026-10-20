/**
 * Shared model definitions used by the client-side model selector and the
 * server-side `/api/chat` route (which validates the requested model id).
 *
 * These map to real Anthropic models available through the configured API key,
 * see `app/lib/.server/llm/model.ts`.
 */

export interface ModelInfo {
  id: string;
  label: string;
}

export const DEFAULT_MODEL_ID = 'claude-3-5-sonnet-20240620';

export const AVAILABLE_MODELS: ModelInfo[] = [
  { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
];

export function isValidModelId(id: string | undefined): id is string {
  return !!id && AVAILABLE_MODELS.some((model) => model.id === id);
}
