/**
 * `@types/react-dom` (v18) does not ship declarations for the
 * `react-dom/server.browser` entry point, even though the runtime module
 * exists. We import `renderToReadableStream` from it in `entry.server.tsx`
 * because the default `react-dom/server` resolves to the Node streams build
 * under our Vite SSR setup, which does not export `renderToReadableStream`.
 *
 * The types below mirror the browser (web streams) server renderer API.
 */
declare module 'react-dom/server.browser' {
  export interface RenderToReadableStreamOptions {
    identifierPrefix?: string;
    namespaceURI?: string;
    nonce?: string;
    onCompleteAll?: () => void;
    onError?: (error: unknown) => void | Promise<void>;
    progressiveChunkSize?: number;
    signal?: AbortSignal;
  }

  export function renderToReadableStream(
    children: React.ReactNode,
    options?: RenderToReadableStreamOptions,
  ): Promise<ReadableStream & { allReady: Promise<void> }>;
}
