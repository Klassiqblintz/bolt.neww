/**
 * The output limits of the Anthropic models.
 *
 * The request asks for a large output budget, but a provider rejects a
 * request whose `max_tokens` is above the limit of the model. The limit
 * depends on the model, so it is looked up instead of being sent blindly.
 * Sending a budget that is too large produces a 400 before a single token is
 * generated, which is reported to the user as a failed request.
 */

/**
 * The beta that raises the output limit of Claude 3.5 Sonnet to 8192 tokens.
 */
export const ANTHROPIC_MAX_TOKENS_BETA = 'max-tokens-3-5-sonnet-2024-07-15';

/**
 * The models whose output limit is known.
 */
const ANTHROPIC_OUTPUT_LIMITS: Record<string, number> = {
  'claude-3-5-sonnet-20240620': 8192,
  'claude-3-5-sonnet-20241022': 8192,
  'claude-3-opus-20240229': 4096,
  'claude-3-haiku-20240307': 4096,
  'claude-3-sonnet-20240229': 4096,
};

/**
 * The output limit of a model, or `undefined` when the model is not known.
 */
export function getAnthropicOutputLimit(modelId: string | undefined): number | undefined {
  if (!modelId) {
    return undefined;
  }

  const known = ANTHROPIC_OUTPUT_LIMITS[modelId];

  if (known !== undefined) {
    return known;
  }

  /**
   * The remaining Claude 3 models that predate Claude 3.5 stop at 4096 tokens.
   * Every newer model accepts at least 8192.
   */
  if (/^claude-3-(opus|haiku|sonnet)-/.test(modelId)) {
    return 4096;
  }

  return undefined;
}

/**
 * Whether the model needs the beta header to allow the requested output.
 *
 * Claude 3.5 Sonnet (20240620) allows 8192 tokens only with the beta header,
 * without it the provider stops at 4096.
 */
export function needsAnthropicMaxTokensBeta(modelId: string | undefined): boolean {
  return modelId === 'claude-3-5-sonnet-20240620';
}
