import { describe, expect, it } from 'vitest';
import { buildChatRequestBody } from '~/lib/chat-request';

describe('buildChatRequestBody', () => {
  it('sends the selected model with its provider so the server can route it', () => {
    const body = buildChatRequestBody({
      modelId: 'my-company/internal-model-v2',
      provider: { type: 'openai-compatible', baseUrl: 'https://api.example.com/v1' },
      buildMode: 'website',
      planningMode: false,
    });

    expect(body.modelId).toBe('my-company/internal-model-v2');
    expect(body.provider?.type).toBe('openai-compatible');
    expect(body.provider?.baseUrl).toBe('https://api.example.com/v1');
    expect(body.buildMode).toBe('website');
    expect(body.planningMode).toBe(false);
  });

  it('sends no provider when none is configured, so the server provider is used', () => {
    const body = buildChatRequestBody({ modelId: 'claude-3-5-sonnet-20240620' });

    expect(body.provider).toBeUndefined();
    expect(body.modelId).toBe('claude-3-5-sonnet-20240620');
  });

  it('never carries a credential', () => {
    const body = buildChatRequestBody({ modelId: 'm', buildMode: 'app', planningMode: false });

    expect(JSON.stringify(body)).not.toMatch(/apiKey|authorization|Bearer|sk-/i);
  });

  it('replaces an unknown build mode with the default instead of sending it', () => {
    expect(buildChatRequestBody({ buildMode: 'hologram' }).buildMode).toBe('app');
    expect(buildChatRequestBody({ buildMode: undefined }).buildMode).toBe('app');
    expect(buildChatRequestBody({ buildMode: 42 as unknown as string }).buildMode).toBe('app');
  });

  it('keeps every offered build mode', () => {
    for (const mode of ['website', 'slides', 'app', 'prototype']) {
      expect(buildChatRequestBody({ buildMode: mode }).buildMode).toBe(mode);
    }
  });

  it('only reports planning mode when it is explicitly on', () => {
    expect(buildChatRequestBody({ planningMode: true }).planningMode).toBe(true);
    expect(buildChatRequestBody({ planningMode: false }).planningMode).toBe(false);
    expect(buildChatRequestBody({}).planningMode).toBe(false);
    expect(buildChatRequestBody({ planningMode: 'yes' as unknown as boolean }).planningMode).toBe(false);
  });
});
