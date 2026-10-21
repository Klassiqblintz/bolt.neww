import { memo } from 'react';
import { classNames } from '~/utils/classNames';
import { Markdown } from './Markdown';

interface AssistantMessageProps {
  content: string;

  /** Whether this answer is still arriving, which shows a caret at its end. */
  isStreaming?: boolean;
}

export const AssistantMessage = memo(({ content, isStreaming = false }: AssistantMessageProps) => {
  return (
    <div className="overflow-hidden w-full">
      <Markdown html>{content}</Markdown>

      {/**
       * A caret at the end of the growing answer, so it is clear that more is
       * on the way. It is a sibling of the markdown, so it never becomes part
       * of the parsed content.
       */}
      {isStreaming && content.length > 0 && (
        <span
          aria-hidden="true"
          data-testid="streaming-caret"
          className={classNames(
            'inline-block w-[7px] h-[1.1em] align-text-bottom ml-0.5 animate-pulse rounded-sm',
            'bg-bolt-elements-textSecondary',
          )}
        />
      )}
    </div>
  );
});
