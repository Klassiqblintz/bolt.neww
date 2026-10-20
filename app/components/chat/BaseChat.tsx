import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import React, { type RefCallback } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { toast } from 'react-toastify';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { buildModeStore, chatOptionsStore } from '~/lib/stores/buildMode';
import { showWorkbenchStore } from '~/lib/stores/workbenchVisibility';
import { classNames } from '~/utils/classNames';
import { BuildModeSelector, getPlaceholderForMode } from './BuildModeSelector';
import { Messages } from './Messages.client';
import { ModelSelector } from './ModelSelector';
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
                className={classNames(styles.Hero, 'mt-[10vh] sm:mt-[15vh] max-w-chat mx-auto px-4 sm:px-6')}
              >
                <h1 className="text-4xl sm:text-5xl text-center font-bold text-bolt-elements-textPrimary mb-3 tracking-tight">
                  What will you build today?
                </h1>
                <p className="mb-1 text-center text-bolt-elements-textSecondary">
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
                    'shadow-sm border border-bolt-elements-borderColor bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] rounded-2xl overflow-hidden transition-theme',
                    {
                      'border-bolt-elements-borderColorActive': input.length > 0,
                    },
                  )}
                >
                  <textarea
                    ref={textareaRef}
                    className="w-full pl-4 pt-4 pr-16 focus:outline-none resize-none text-md text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent"
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
                    placeholder={chatStarted ? 'How can Bolt help you today?' : getPlaceholderForMode(buildMode)}
                    translate="no"
                  />
                  <ClientOnly>
                    {() => (
                      <SendButton
                        show={input.length > 0 || isStreaming}
                        isStreaming={isStreaming}
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
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm p-3 pt-2">
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
                    <div className="flex gap-1 items-center">
                      <IconButton
                        title={
                          planningMode
                            ? 'Planning mode is on: Bolt outlines a plan before coding (click to disable)'
                            : 'Planning mode: ask Bolt to outline a plan before coding'
                        }
                        className={classNames('gap-1.5 px-2', {
                          'text-bolt-elements-item-contentAccent! bg-bolt-elements-item-backgroundAccent!':
                            planningMode,
                        })}
                        onClick={() => {
                          chatOptionsStore.setKey('planningMode', !planningMode);
                        }}
                      >
                        <div className="i-ph:lightbulb text-xl" />
                        <span className="text-sm">Plan</span>
                      </IconButton>
                      <ClientOnly>{() => <ModelSelector />}</ClientOnly>
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
                <BuildModeSelector />
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
