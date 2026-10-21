/**
 * The build modes the composer offers.
 *
 * This module is free of browser APIs and of any mutable state on purpose: the
 * client renders the selector and sends the selected mode along with the
 * request, the server turns it into part of the system prompt. Keeping the
 * definition in one place means both sides always agree on which modes exist
 * and what they ask for.
 */
export type BuildMode = 'website' | 'slides' | 'app' | 'prototype';

export const DEFAULT_BUILD_MODE: BuildMode = 'app';

export interface BuildModeOption {
  id: BuildMode;
  label: string;
  icon: string;
}

/**
 * The four modes, in the order they are presented.
 *
 * The icons are Phosphor icons from the collection that is already installed.
 * They are referenced as UnoCSS icon classes, so the class name has to survive
 * the build, see `content.pipeline.include` in `uno.config.ts`.
 */
export const BUILD_MODES: BuildModeOption[] = [
  { id: 'website', label: 'Website', icon: 'i-ph:globe-hemisphere-west' },
  { id: 'slides', label: 'Slides', icon: 'i-ph:presentation-chart' },
  { id: 'app', label: 'App', icon: 'i-ph:device-mobile' },
  { id: 'prototype', label: 'Prototype', icon: 'i-ph:flask' },
];

/**
 * What the model is asked to build for each mode.
 *
 * Every mode runs through the same artifact pipeline, the instruction only
 * steers what the assistant produces.
 */
const BUILD_MODE_INSTRUCTIONS: Record<BuildMode, string> = {
  website:
    'The user wants to build a website. Focus on delivering a polished, responsive website with clean layout, typography and styling.',
  slides:
    'The user wants to build a slide deck. Deliver a presentation (e.g. reveal.js or an HTML slide viewer) with multiple slides, navigation and speaker-friendly content.',
  app: 'The user wants to build a full application. Focus on a working app with multiple features and a coherent user flow.',
  prototype:
    'The user wants a quick interactive prototype. Prioritize demonstrating the core idea and interactions over production polish or completeness.',
};

export const PLANNING_INSTRUCTION =
  'Before writing any code, first outline a concise step-by-step plan for this request. Then continue with the implementation.';

/**
 * Whether the given value names one of the supported build modes.
 */
export function isBuildMode(value: unknown): value is BuildMode {
  return typeof value === 'string' && BUILD_MODES.some((mode) => mode.id === value);
}

/**
 * The instruction that tells the model what kind of deliverable to create.
 */
export function getBuildModeInstruction(mode: BuildMode): string {
  return BUILD_MODE_INSTRUCTIONS[mode];
}

/**
 * Builds the generation context for the selected build mode.
 *
 * The context is added to the system prompt, so it steers the generation
 * without ever ending up in the user's message.
 */
export function buildGenerationContext(mode: BuildMode, planningMode: boolean): string {
  const parts = [getBuildModeInstruction(mode)];

  if (planningMode) {
    parts.push(PLANNING_INSTRUCTION);
  }

  return parts.join('\n\n');
}
