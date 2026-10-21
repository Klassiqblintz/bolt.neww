// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Message } from 'ai';
import { Messages } from '~/components/chat/Messages.client';

/**
 * The markdown pipeline pulls in the artifact parser and Shiki, which are not
 * relevant to the layout under test. The stub keeps the test about the
 * transcript structure while still proving the content is rendered.
 */
vi.mock('~/components/chat/Markdown', () => ({
  Markdown: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

const userMessage: Message = { id: '1', role: 'user', content: 'Build me a landing page' };
const assistantMessage: Message = { id: '2', role: 'assistant', content: 'Sure, here is the plan.' };

describe('Messages', () => {
  it('renders a user prompt and an assistant answer', () => {
    render(<Messages messages={[userMessage, assistantMessage]} />);

    expect(screen.getByText('Build me a landing page')).toBeInTheDocument();
    expect(screen.getByText('Sure, here is the plan.')).toBeInTheDocument();
  });

  it('never repeats a user prompt inside the assistant answer', () => {
    render(<Messages messages={[userMessage, assistantMessage]} />);

    const markdownBlocks = screen.getAllByTestId('markdown');

    expect(markdownBlocks).toHaveLength(2);
    expect(markdownBlocks[1].textContent).toBe('Sure, here is the plan.');
    expect(markdownBlocks[1].textContent).not.toContain('Build me a landing page');
  });

  it('shows a thinking state while waiting for the first answer token', () => {
    render(<Messages messages={[userMessage]} isStreaming />);

    expect(screen.getByRole('status', { name: 'Bolt is thinking' })).toBeInTheDocument();
  });

  it('stops showing the thinking state once the answer has started', () => {
    render(<Messages messages={[userMessage, assistantMessage]} isStreaming />);

    expect(screen.queryByRole('status', { name: 'Bolt is thinking' })).not.toBeInTheDocument();
  });

  it('shows a caret only on the message that is streaming', () => {
    render(<Messages messages={[userMessage, assistantMessage]} isStreaming />);

    expect(screen.getAllByTestId('streaming-caret')).toHaveLength(1);
  });

  it('shows no caret when nothing is streaming', () => {
    render(<Messages messages={[userMessage, assistantMessage]} />);

    expect(screen.queryByTestId('streaming-caret')).not.toBeInTheDocument();
  });

  it('starts empty when a new conversation has no messages', () => {
    render(<Messages messages={[]} />);

    expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
