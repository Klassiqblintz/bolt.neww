import { ERROR_CODES, formatError } from '~/lib/errors';
import { getUpstreamMessage } from './errors';
import { redactSecrets, redactValue } from './redact';

export default class SwitchableStream extends TransformStream {
  private _controller: TransformStreamDefaultController | null = null;
  private _currentReader: ReadableStreamDefaultReader | null = null;
  private _switches = 0;

  /**
   * Whether the stream was closed on purpose.
   *
   * A closed stream rejects further writes. The pump has to stop with it,
   * otherwise the last write of a response that completed normally throws,
   * and that throw would be reported to the user as a failed request even
   * though the answer arrived in full.
   */
  private _closed = false;

  constructor() {
    let controllerRef: TransformStreamDefaultController | undefined;

    super({
      start(controller) {
        controllerRef = controller;
      },
    });

    if (controllerRef === undefined) {
      throw new Error('Controller not properly initialized');
    }

    this._controller = controllerRef;
  }

  async switchSource(newStream: ReadableStream) {
    if (this._currentReader) {
      await this._currentReader.cancel();
    }

    this._currentReader = newStream.getReader();

    this._pumpStream();

    this._switches++;
  }

  private async _pumpStream() {
    if (!this._currentReader || !this._controller) {
      throw new Error('Stream is not properly initialized');
    }

    const reader = this._currentReader;
    const controller = this._controller;

    try {
      while (!this._closed) {
        const { done, value } = await reader.read();

        /**
         * The stream may have been closed while this read was pending. The
         * closed stream refuses the chunk, so it is dropped instead of being
         * turned into a failure.
         */
        if (done || this._closed) {
          break;
        }

        controller.enqueue(value);
      }
    } catch (error) {
      if (this._closed) {
        return;
      }

      /**
       * A failure in the middle of a stream cannot be reported with a status
       * code any more, so the reason is turned into the same shape a failed
       * request uses. The raw error only goes to the log, and it is redacted
       * because a provider can echo part of the request back in it.
       */
      console.error('The provider stream failed\n\n', redactValue(error));

      const detail = getUpstreamMessage(error);

      const message = redactSecrets(
        detail
          ? `The AI provider could not complete the request: ${detail}`
          : 'The AI provider closed the connection before the response was finished. Try again.',
      );

      try {
        controller.error(new Error(formatError({ code: ERROR_CODES.PROVIDER_ERROR, message })));
      } catch {
        /**
         * The stream was already closed when the failure was reported, so
         * there is nothing left to attach it to. The reason is in the log.
         */
      }
    }
  }

  close() {
    if (this._closed) {
      return;
    }

    this._closed = true;

    this._currentReader?.cancel().catch(() => undefined);

    try {
      this._controller?.terminate();
    } catch {
      /**
       * The controller was already terminated, closing twice is harmless.
       */
    }
  }

  get switches() {
    return this._switches;
  }
}
