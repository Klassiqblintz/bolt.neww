import { describe, expect, it } from 'vitest';
import { getAnthropicOutputLimit, needsAnthropicMaxTokensBeta } from './model-limits';

describe('getAnthropicOutputLimit', () => {
  it('reports the limit of the models the application offers', () => {
    expect(getAnthropicOutputLimit('claude-3-5-sonnet-20240620')).toBe(8192);
    expect(getAnthropicOutputLimit('claude-3-opus-20240229')).toBe(4096);
    expect(getAnthropicOutputLimit('claude-3-haiku-20240307')).toBe(4096);
  });

  it('keeps the legacy Claude 3 models at 4096 when the exact id is unknown', () => {
    expect(getAnthropicOutputLimit('claude-3-opus-some-new-build')).toBe(4096);
    expect(getAnthropicOutputLimit('claude-3-haiku-20240307-hello')).toBe(4096);
  });

  it('does not hold modern models back', () => {
    expect(getAnthropicOutputLimit('claude-3-5-sonnet-20241022')).toBe(8192);

    /**
     * Nothing is known about the model, so no cap is applied and the caller
     * uses its default budget. Reporting 4096 for an unknown model would
     * silently cut the output of every model newer than this list.
     */
    expect(getAnthropicOutputLimit('claude-sonnet-4-20250514')).toBeUndefined();
    expect(getAnthropicOutputLimit('claude-opus-4-20250514')).toBeUndefined();
  });

  it('leaves the decision to the caller when nothing is known about the model', () => {
    expect(getAnthropicOutputLimit(undefined)).toBeUndefined();
    expect(getAnthropicOutputLimit('')).toBeUndefined();
    expect(getAnthropicOutputLimit('some-unknown-model')).toBeUndefined();
  });
});

describe('needsAnthropicMaxTokensBeta', () => {
  it('asks for the beta exactly for the model that only allows 4096 without it', () => {
    expect(needsAnthropicMaxTokensBeta('claude-3-5-sonnet-20240620')).toBe(true);
  });

  it('does not ask for the beta from other models', () => {
    expect(needsAnthropicMaxTokensBeta('claude-3-opus-20240229')).toBe(false);
    expect(needsAnthropicMaxTokensBeta('claude-3-5-sonnet-20241022')).toBe(false);
    expect(needsAnthropicMaxTokensBeta(undefined)).toBe(false);
  });
});
