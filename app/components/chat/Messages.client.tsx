import type { Message } from 'ai';
import React from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
}

/**
 * The conversation transcript.
 *
 * User prompts render as compact, right aligned bubbles, assistant answers as
 * plain readable text in the content column. There is no card around every
 * message and no repeated avatar: cards are reserved for what the assistant
 * actually produces (artifacts, files, previews) inside the answer itself.
 */
export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>((props: MessagesProps, ref) => {
  const { id, isStreaming = false, messages = [] } = props;

  const lastMessage = messages[messages.length - 1];
  const waitingForAnswer = !lastMessage || lastMessage.role === 'user';

  return (
    <div id={id} ref={ref} className={props.className}>
      {messages.map((message, index) => {
        const { role, content } = message;
        const isUserMessage = role === 'user';

        if (isUserMessage) {
          return (
            <div key={index} className={classNames('flex justify-end w-full', { 'mt-6': index > 0 })}>
              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-bolt-elements-messages-background px-4 py-2.5">
                <UserMessage content={content} />
              </div>
            </div>
          );
        }

        /**
         * The very last assistant message is the one being streamed, so it
         * gets the caret. Every earlier answer is finished content.
         */
        const isStreamingMessage = isStreaming && index === messages.length - 1;

        return (
          <div key={index} className={classNames('w-full overflow-hidden', { 'mt-6': index > 0 })}>
            <AssistantMessage content={content} isStreaming={isStreamingMessage} />
          </div>
        );
      })}

      {/**
       * Generation state: shown while the request is in flight and no answer
       * has arrived yet. Once the model streams content, the growing answer is
       * the indicator itself.
       */}
      {isStreaming && waitingForAnswer && (
        <div
          role="status"
          aria-label="Bolt is thinking"
          className="flex items-center gap-1.5 mt-6 text-bolt-elements-textSecondary"
        >
          <span className="i-svg-spinners:3-dots-fade text-3xl" aria-hidden="true" />
        </div>
      )}
    </div>
  );
});
