import { describe, expect, it } from 'vitest';
import {
  getLiveChatHref,
  PRIMARY_NAV,
  PROVIDER_NAV,
  SECONDARY_NAV,
  type NavItem,
} from '~/components/sidebar/navigation';

const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...PROVIDER_NAV, ...SECONDARY_NAV];

describe('sidebar navigation', () => {
  it('offers the five primary destinations in order', () => {
    expect(PRIMARY_NAV.map((item) => item.label)).toEqual([
      'Home',
      'Projects',
      'Starred',
      'Recently viewed',
      'Live chat',
    ]);
  });

  it('offers provider management separately', () => {
    expect(PROVIDER_NAV.map((item) => item.label)).toEqual(['AI providers']);
  });

  it('offers the three secondary destinations in order', () => {
    expect(SECONDARY_NAV.map((item) => item.label)).toEqual(['Help center', 'Release notes', 'Status']);
  });

  it('points every destination at a real route', () => {
    const expected: Record<string, string> = {
      Home: '/',
      Projects: '/projects',
      Starred: '/starred',
      'Recently viewed': '/recently-viewed',
      'Live chat': '/',
      'AI providers': '/providers',
      'Help center': '/help',
      'Release notes': '/release-notes',
      Status: '/status',
    };

    for (const item of ALL_NAV) {
      expect(item.href).toBe(expected[item.label]);
    }
  });

  it('uses an icon from the installed library for every destination', () => {
    for (const item of ALL_NAV) {
      expect(item.icon).toMatch(/^i-(ph|bolt):[a-z-]+$/);
    }
  });

  it('uses a distinct icon for every destination', () => {
    const icons = ALL_NAV.map((item) => item.icon);

    expect(new Set(icons).size).toBe(icons.length);
  });

  it('uses the required icon for each destination', () => {
    const required: Record<string, string> = {
      Home: 'i-ph:house',
      Projects: 'i-ph:folder-notch',
      Starred: 'i-ph:star',
      'Recently viewed': 'i-ph:clock-counter-clockwise',
      'Live chat': 'i-ph:broadcast',
      'AI providers': 'i-ph:plugs',
    };

    for (const [label, icon] of Object.entries(required)) {
      expect(ALL_NAV.find((item) => item.label === label)?.icon).toBe(icon);
    }
  });

  it('highlights home only on the root path', () => {
    const home = PRIMARY_NAV.find((item) => item.label === 'Home');

    expect(home?.matches?.('/')).toBe(true);
    expect(home?.matches?.('/projects')).toBe(false);
    expect(home?.matches?.('/chat/42')).toBe(false);
  });

  it('highlights live chat on a conversation path', () => {
    const liveChat = PRIMARY_NAV.find((item) => item.label === 'Live chat');

    expect(liveChat?.matches?.('/chat/42')).toBe(true);
    expect(liveChat?.matches?.('/')).toBe(false);
  });

  it('does not highlight starred and recently viewed on each other', () => {
    const starred = PRIMARY_NAV.find((item) => item.label === 'Starred');
    const recent = PRIMARY_NAV.find((item) => item.label === 'Recently viewed');

    expect(starred?.matches?.('/starred')).toBe(true);
    expect(starred?.matches?.('/recently-viewed')).toBe(false);
    expect(recent?.matches?.('/recently-viewed')).toBe(true);
    expect(recent?.matches?.('/starred')).toBe(false);
  });
});

describe('live chat destination', () => {
  it('opens the current conversation while one is open', () => {
    expect(getLiveChatHref('42')).toBe('/chat/42');
  });

  it('starts a new conversation when none is open', () => {
    expect(getLiveChatHref(undefined)).toBe('/');
  });
});
