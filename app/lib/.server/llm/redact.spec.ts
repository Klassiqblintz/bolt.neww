import { describe, expect, it } from 'vitest';
import { redactSecrets, redactValue } from './redact';

describe('redactSecrets', () => {
  it.each([
    ['sk-ant-api03-abcdefghijklmnop', '[redacted]'],
    ['sk-or-v1-abcdefghijklmnop', '[redacted]'],
    ['sk-or-user-key', '[redacted]'],
    ['sk-short-12345678', '[redacted]'],
    ['gsk_abcdefgh12345678', '[redacted]'],
    ['AIzaSyAbCdEfGhIjKlMnOpQrStUvWx', '[redacted]'],
    ['xai-abcdefghijklmnop', '[redacted]'],
    ['hf_ABCDEFGHIJKLMNOP', '[redacted]'],
    ['Authorization: Bearer abcdefghijklmnop', 'Authorization: [redacted]'],
    ['apiKey: "sk-ant-secret"', 'apiKey: [redacted]'],
  ])('removes the credential %s', (input) => {
    expect(redactSecrets(input)).not.toMatch(/sk-ant|sk-or|sk-[A-Za-z0-9]{8}|gsk_|AIza|xai-|hf_|abcdefgh/);
  });

  it('redacts a short key that appears in a provider message', () => {
    const output = redactSecrets('The provider rejected your key sk-or-user-key, check the key.');

    expect(output).not.toContain('sk-or-user-key');
    expect(output).toContain('The provider rejected your key');
  });

  it('leaves ordinary words that merely contain sk- alone', () => {
    expect(redactSecrets('the task-manager and disk-foreground jobs')).toBe(
      'the task-manager and disk-foreground jobs',
    );
  });

  it('leaves model identifiers alone', () => {
    expect(redactSecrets('openai/gpt-4o and claude-3-opus-20240229')).toBe('openai/gpt-4o and claude-3-opus-20240229');
  });
});

describe('redactValue', () => {
  it('redacts an error message', () => {
    const output = redactValue(new Error('401 invalid key sk-ant-api03-topsecretvalue'));

    expect(output).not.toContain('sk-ant-api03-topsecretvalue');
    expect(output).toContain('Error: 401 invalid key');
  });

  it('redacts a nested object', () => {
    const output = redactValue({ authorization: 'Bearer abcdefghijklmnop1234' });

    expect(output).not.toContain('abcdefghijklmnop1234');
  });

  it('handles the primitives without throwing', () => {
    expect(redactValue(undefined)).toBe('undefined');
    expect(redactValue(null)).toBe('null');
    expect(redactValue('plain text')).toBe('plain text');
  });

  it('reports an unserialisable value instead of throwing', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(redactValue(cyclic)).toBe('[unserializable]');
  });
});
