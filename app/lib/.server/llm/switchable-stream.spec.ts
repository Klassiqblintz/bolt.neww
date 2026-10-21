import { describe, expect, it, vi } from 'vitest';
import SwitchableStream from './switchable-stream';

const encoder = new TextEncoder();

/**
 * A source that delivers part of a response and then fails, the way a
 * provider drops the connection part way through.
 *
 * The failure is scheduled so the first chunk really is delivered before the
 * stream breaks, otherwise it would be discarded together with the queue.
 */
function failingStream(error: unknown): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('partial response'));

      setTimeout(() => controller.error(error), 0);
    },
  });
}

/**
 * Reads a stream that fails in the middle and returns the error that reaches
 * the other end.
 */
async function readUntilFailure(stream: ReadableStream): Promise<{ chunks: string[]; error?: unknown }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(decoder.decode(value));
    }

    return { chunks };
  } catch (error) {
    return { chunks, error };
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

describe('SwitchableStream', () => {
  it('classifies a mid-stream failure instead of forwarding a raw error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const stream = new SwitchableStream();

      await stream.switchSource(failingStream(new Error('the upstream socket closed')));

      const { error } = await readUntilFailure(stream.readable);

      expect(error).toBeInstanceOf(Error);
      expect(messageOf(error)).toMatch(/^\[provider_error\]/);
      expect(messageOf(error)).toContain('the upstream socket closed');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('never lets a provider echo back a credential in the failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const stream = new SwitchableStream();

      await stream.switchSource(failingStream(new Error('401 unauthorized, api key sk-ant-api03-topsecretaaaaaaaaa')));

      const { error } = await readUntilFailure(stream.readable);

      expect(messageOf(error)).not.toContain('sk-ant-api03-topsecretaaaaaaaaa');
      expect(messageOf(error)).toMatch(/^\[provider_error\]/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('falls back to a readable message when the failure carries no detail', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const stream = new SwitchableStream();

      await stream.switchSource(failingStream(undefined));

      const { error } = await readUntilFailure(stream.readable);

      expect(messageOf(error)).toMatch(/^\[provider_error\]/);
      expect(messageOf(error)).toContain('closed the connection');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('delivers what was read before the failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const stream = new SwitchableStream();

      await stream.switchSource(failingStream(new Error('boom')));

      const { chunks } = await readUntilFailure(stream.readable);

      expect(chunks.join('')).toBe('partial response');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('drops a chunk that arrives after it closed instead of reporting a failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      let source: ReadableStreamDefaultController | undefined;

      const pending = new ReadableStream<Uint8Array>({
        start(controller) {
          source = controller;
        },
      });

      const stream = new SwitchableStream();

      await stream.switchSource(pending);

      /**
       * The read of the pump is still pending, so the chunk resolves it and
       * the close lands before the pump gets to write it. The closed stream
       * refuses the chunk, and that must not be reported as a failed request.
       */
      source?.enqueue(encoder.encode('late chunk'));
      stream.close();

      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('can be closed more than once', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const stream = new SwitchableStream();

      await stream.switchSource(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('done'));
            controller.close();
          },
        }),
      );

      stream.close();

      expect(() => stream.close()).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('writes the raw failure to a redacted log', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const stream = new SwitchableStream();

      await stream.switchSource(failingStream(new Error('key sk-ant-api03-topsecretaaaaaaaaa')));

      await readUntilFailure(stream.readable);

      expect(consoleError).toHaveBeenCalledTimes(1);

      const logged = String(consoleError.mock.calls[0]?.[1] ?? '');

      expect(logged).toContain('Error: key');
      expect(logged).not.toContain('sk-ant-api03-topsecretaaaaaaaaa');
    } finally {
      consoleError.mockRestore();
    }
  });
});
