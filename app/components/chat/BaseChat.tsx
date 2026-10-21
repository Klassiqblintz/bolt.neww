import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import React, { type RefCallback } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { toast } from 'react-toastify';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { buildModeStore, chatOptionsStore } from '~/lib/stores/buildMode';
import { modelsStore } from '~/lib/stores/models';
import { showWorkbenchStore } from '~/lib/stores/workbenchVisibility';
import { classNames } from '~/utils/classNames';
import { BuildModeSelector, getPlaceholderForMode } from './BuildModeSelector';
import { Messages } from './Messages.client';
import { ModelSelector } from './ModelSelector';
import { ProviderIndicator } from './ProviderIndicator';
import { RecentlyViewed } from './RecentlyViewed';
import { SendButton } from './SendButton.client';

import styles from './BaseChat.module.scss';

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onDismissError?: () => void;
  messages?: Message[];
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
}

const TEXTAREA_MIN_HEIGHT = 76;

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      hasError = false,
      errorMessage,
      onDismissError,
      enhancingPrompt = false,
      promptEnhanced = false,
      messages,
      input = '',
      sendMessage,
      handleInputChange,
      enhancePrompt,
      handleStop,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    const buildMode = useStore(buildModeStore);
    const { planningMode } = useStore(chatOptionsStore);
    const { unavailableModelId } = useStore(modelsStore);
    const showWorkbench = useStore(showWorkbenchStore);

    return (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          'relative flex h-full w-full overflow-hidden bg-bolt-elements-background-depth-1',
        )}
        data-chat-visible={showChat}
        data-workbench-visible={showWorkbench}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div ref={scrollRef} className="flex overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow min-w-[var(--chat-min-width)] h-full')}>
            {!chatStarted && (
              <div
                id="intro"
                className={classNames(styles.Hero, 'pt-[8vh] sm:pt-[13vh] max-w-chat mx-auto px-4 sm:px-6')}
              >
                <div className="flex justify-center mb-5">
                  <span
                    className={classNames(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs sm:text-sm font-medium border',
                      styles.Eyebrow,
                    )}
                  >
                    <div className="i-ph:sparkle" />
                    AI app builder
                  </span>
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl text-center font-bold text-bolt-elements-textPrimary mb-4 tracking-tight leading-[1.1]">
                  What will you build today?
                </h1>
                <p className="mb-1 text-center text-bolt-elements-textSecondary text-base sm:text-lg max-w-xl mx-auto">
                  Build apps and websites by chatting with AI. Describe your idea and Bolt writes the code.
                </p>
              </div>
            )}
            <div
              className={classNames('pt-6 px-4 sm:px-6', {
                'h-full flex flex-col': chatStarted,
              })}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <Messages
                      ref={messageRef}
                      className="flex flex-col w-full flex-1 max-w-chat px-4 pb-6 mx-auto z-1"
                      messages={messages}
                      isStreaming={isStreaming}
                    />
                  ) : null;
                }}
              </ClientOnly>
              <div
                className={classNames('relative w-full max-w-chat mx-auto z-prompt', {
                  'sticky bottom-0': chatStarted,
                })}
              >
                <div
                  className={classNames(
                    styles.Composer,
                    'shadow-sm border border-bolt-elements-borderColor bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] rounded-2xl sm:rounded-3xl overflow-hidden',
                  )}
                >
                  {unavailableModelId && (
                    <div
                      role="status"
                      className="flex items-start gap-2 px-4 sm:px-5 pt-4 text-sm text-bolt-elements-icon-error"
                    >
                      <div className="i-ph:warning-circle-bold text-base shrink-0 mt-px" />
                      <span className="flex-1">
                        The saved model “{unavailableModelId}” is not available for the configured provider. Pick
                        another model in the dropdown.
                      </span>
                    </div>
                  )}
                  {errorMessage && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 px-4 sm:px-5 pt-4 text-sm text-bolt-elements-icon-error"
                    >
                      <div className="i-ph:warning-circle-bold text-base shrink-0 mt-px" />
                      <span className="flex-1">{errorMessage}</span>
                      <button
                        type="button"
                        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity duration-150"
                        title="Dismiss"
                        aria-label="Dismiss error"
                        onClick={onDismissError}
                      >
                        <div className="i-ph:x text-base" />
                      </button>
                    </div>
                  )}
                  {/**
                   * The build mode selector lives inside the composer, so it
                   * stays available for the whole conversation. The mode can
                   * still be changed after the first message was sent.
                   */}
                  <div className="border-b border-bolt-elements-borderColor px-3 pb-2 pt-3 sm:px-4 sm:pt-4">
                    <BuildModeSelector />
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="w-full pl-4 sm:pl-5 pt-4 sm:pt-5 pr-16 pb-2 focus:outline-none resize-none text-md sm:text-lg text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        if (event.shiftKey) {
                          return;
                        }

                        event.preventDefault();

                        sendMessage?.(event);
                      }
                    }}
                    value={input}
                    onChange={(event) => {
                      handleInputChange?.(event);
                    }}
                    style={{
                      minHeight: TEXTAREA_MIN_HEIGHT,
                      maxHeight: TEXTAREA_MAX_HEIGHT,
                    }}
                    placeholder={getPlaceholderForMode(buildMode)}
                    translate="no"
                  />
                  <ClientOnly>
                    {() => (
                      <SendButton
                        show
                        isStreaming={isStreaming}
                        hasError={hasError}
                        disabled={input.trim().length === 0}
                        onClick={(event) => {
                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }

                          sendMessage?.(event);
                        }}
                      />
                    )}
                  </ClientOnly>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm px-3 sm:px-4 pb-3 pt-1">
                    <div className="flex gap-1 items-center">
                      <IconButton
                        title="Attach files (not available yet)"
                        className="text-bolt-elements-textTertiary"
                        onClick={() => {
                          toast.info('File attachments are not available yet — but they are coming soon.');
                        }}
                      >
                        <div className="i-ph:paperclip text-xl" />
                      </IconButton>
                      <IconButton
                        title="Enhance prompt"
                        disabled={input.length === 0 || enhancingPrompt}
                        className={classNames({
                          'opacity-100!': enhancingPrompt,
                          'text-bolt-elements-item-contentAccent! pr-1.5 enabled:hover:bg-bolt-elements-item-backgroundAccent!':
                            promptEnhanced,
                        })}
                        onClick={() => enhancePrompt?.()}
                      >
                        {enhancingPrompt ? (
                          <>
                            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl"></div>
                            <div className="ml-1.5">Enhancing prompt...</div>
                          </>
                        ) : (
                          <>
                            <div className="i-bolt:stars text-xl"></div>
                            {promptEnhanced && <div className="ml-1.5">Prompt enhanced</div>}
                          </>
                        )}
                      </IconButton>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <button
                        type="button"
                        title={
                          planningMode
                            ? 'Planning mode is on: Bolt outlines a plan before coding (click to disable)'
                            : 'Planning mode: ask Bolt to outline a plan before coding'
                        }
                        aria-pressed={planningMode}
                        className={classNames(
                          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border transition-colors duration-150',
                          {
                            'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent border-bolt-elements-item-contentAccent':
                              planningMode,
                            'text-bolt-elements-textSecondary border-transparent hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive':
                              !planningMode,
                          },
                        )}
                        onClick={() => {
                          chatOptionsStore.setKey('planningMode', !planningMode);
                        }}
                      >
                        <div className="i-ph:lightbulb text-lg" />
                        <span>Plan</span>
                      </button>
                      <ClientOnly>{() => <ModelSelector />}</ClientOnly>
                      <ClientOnly>{() => <ProviderIndicator />}</ClientOnly>
                    </div>
                  </div>
                </div>
                <div className="bg-bolt-elements-background-depth-1 pb-6">{/* Ghost Element */}</div>
              </div>
            </div>
            {!chatStarted && (
              <div
                id="examples"
                className="relative w-full max-w-chat mx-auto mt-6 mb-10 px-4 sm:px-6 flex flex-col gap-8"
              >
                <RecentlyViewed />
              </div>
            )}
          </div>
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />}</ClientOnly>
        </div>
      </div>
    );
  },
);
