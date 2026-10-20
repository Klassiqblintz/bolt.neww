import { atom, map } from 'nanostores';
import { DEFAULT_MODEL_ID } from '~/lib/models';

/**
 * Build modes shown on the homepage composer. The selected mode is injected
 * into the first user message so the model steers the generated artifact
 * towards that kind of deliverable.
 */
export type BuildMode = 'website' | 'slides' | 'app' | 'prototype';

export const BUILD_MODES: Array<{ id: BuildMode; label: string; icon: string }> = [
  { id: 'website', label: 'Website', icon: 'i-ph:globe-hemisphere-west' },
  { id: 'slides', label: 'Slides', icon: 'i-ph:presentation-chart' },
  { id: 'app', label: 'App', icon: 'i-ph:device-mobile' },
  { id: 'prototype', label: 'Prototype', icon: 'i-ph:shapes' },
];

const BUILD_MODE_INSTRUCTIONS: Record<BuildMode, string> = {
  website:
    'The user wants to build a website. Focus on delivering a polished, responsive website with clean layout, typography and styling.',
  slides:
    'The user wants to build a slide deck. Deliver a presentation (e.g. reveal.js or an HTML slide viewer) with multiple slides, navigation and speaker-friendly content.',
  app: 'The user wants to build a full application. Focus on a working app with multiple features and a coherent user flow.',
  prototype:
    'The user wants a quick interactive prototype. Prioritize demonstrating the core idea and interactions over production polish or completeness.',
};

export function getBuildModeInstruction(mode: BuildMode): string {
  return BUILD_MODE_INSTRUCTIONS[mode];
}

export const buildModeStore = atom<BuildMode>('app');

export interface ChatOptions {
  modelId: string;
  planningMode: boolean;
}

/**
 * Homepage composer options. `modelId` is sent with each chat request and
 * validated server-side; `planningMode` prepends a plan-first instruction to
 * outgoing messages so the assistant outlines an approach before coding.
 */
export const chatOptionsStore = map<ChatOptions>({
  modelId: DEFAULT_MODEL_ID,
  planningMode: false,
});

export const PLANNING_INSTRUCTION =
  'Before writing any code, first outline a concise step-by-step plan for this request. Then continue with the implementation.';
