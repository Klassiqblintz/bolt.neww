import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/cloudflare';
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';
import { cssTransition, ToastContainer } from 'react-toastify';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = 'dark';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

/**
 * The single toast host of the app.
 *
 * Transient notices from any route land here, so a failed catalogue load or a
 * failed delete is reported in the same place instead of only in a route that
 * happens to mount its own host.
 */
function AppToastContainer() {
  return (
    <ToastContainer
      closeButton={({ closeToast }) => {
        return (
          <button className="Toastify__close-button" onClick={closeToast}>
            <div className="i-ph:x text-lg" />
          </button>
        );
      }}
      icon={({ type }) => {
        switch (type) {
          case 'success': {
            return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
          }
          case 'error': {
            return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
          }
        }

        return undefined;
      }}
      position="bottom-right"
      pauseOnFocusLoss
      transition={toastAnimation}
    />
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      {children}
      <ScrollRestoration />
      <Scripts />
      <AppToastContainer />
    </>
  );
}

export default function App() {
  return <Outlet />;
}

/**
 * The last line of defence when a route throws while rendering.
 *
 * Without it the router shows its own bare error page. This keeps the theme,
 * explains what happened in plain language and gives the user a way back home
 * instead of a dead end.
 */
export function ErrorBoundary() {
  const error = useRouteError();

  let status = 500;
  let title = 'Something went wrong';
  let detail = 'An unexpected error stopped this page from loading.';

  if (isRouteErrorResponse(error)) {
    status = error.status;
    title = error.status === 404 ? 'Page not found' : `Request failed (${error.status})`;
    detail = error.status === 404 ? 'That page does not exist.' : error.statusText || detail;
  } else if (error instanceof Error && error.message) {
    detail = error.message;
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bolt-elements-background-depth-1 px-4">
      <div className="w-full max-w-md rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-6 text-center">
        <div className="i-ph:warning-circle-bold mx-auto text-3xl text-bolt-elements-icon-error" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold text-bolt-elements-textPrimary">{title}</h1>
        <p className="mt-1.5 text-sm text-bolt-elements-textSecondary" role="alert">
          {detail}
        </p>
        <p className="mt-1 text-xs text-bolt-elements-textTertiary">Error code: {status}</p>
        <a
          href="/"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-bolt-elements-item-backgroundAccent px-4 py-2 text-sm font-medium text-bolt-elements-item-contentAccent transition-opacity duration-150 hover:opacity-90"
        >
          Back to the workspace
        </a>
      </div>
    </div>
  );
}
