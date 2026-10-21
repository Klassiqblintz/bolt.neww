import { describe, expect, it } from 'vitest';
import {
  hasPersistenceErrorFlag,
  PERSISTENCE_ERROR_PARAM,
  withPersistenceErrorFlag,
  withoutPersistenceErrorFlag,
} from '~/lib/app-shell';

describe('persistence error flag', () => {
  it('reports a URL that carries the flag', () => {
    expect(hasPersistenceErrorFlag('/chat/42?persistError=1')).toBe(true);
  });

  it('reports a URL without the flag', () => {
    expect(hasPersistenceErrorFlag('/chat/42')).toBe(false);
    expect(hasPersistenceErrorFlag('/chat/42?other=1')).toBe(false);
  });

  it('adds the flag and keeps the rest of the URL', () => {
    expect(withPersistenceErrorFlag('/chat/42?foo=bar#section')).toBe('/chat/42?foo=bar&persistError=1#section');
  });

  it('adds the flag to a URL that has no query', () => {
    expect(withPersistenceErrorFlag('/chat/42')).toBe('/chat/42?persistError=1');
  });

  it('removes the flag and keeps the rest of the URL', () => {
    expect(withoutPersistenceErrorFlag('/chat/42?foo=bar&persistError=1#section')).toBe('/chat/42?foo=bar#section');
  });

  it('removes the flag from a URL where it is the only parameter', () => {
    expect(withoutPersistenceErrorFlag('/chat/42?persistError=1')).toBe('/chat/42');
  });

  it('leaves a URL without the flag unchanged', () => {
    expect(withoutPersistenceErrorFlag('/chat/42?foo=bar')).toBe('/chat/42?foo=bar');
  });

  it('round trips', () => {
    const href = '/chat/42?foo=bar';

    expect(withoutPersistenceErrorFlag(withPersistenceErrorFlag(href))).toBe(href);
  });

  it('uses one shared parameter name', () => {
    expect(PERSISTENCE_ERROR_PARAM).toBe('persistError');
  });
});
