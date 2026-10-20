import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, transformWithEsbuild, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import fs from 'node:fs/promises';

export default defineConfig((config) => {
  return {
    build: {
      target: 'esnext',
    },
    plugins: [
      nodePolyfills({
        include: ['path', 'buffer'],
      }),

      /**
       * The Cloudflare dev proxy requires the Miniflare (Workers) runtime, which
       * cannot start in every environment (e.g. Android, where its memory mapping
       * fails). Set `DISABLE_CF_PROXY=1` to run the dev server as a plain Node
       * app instead. The AI chat API is the only feature that needs the runtime.
       */
      !process.env.DISABLE_CF_PROXY && config.mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
      config.mode === 'test' && restoreClientModulesPlugin(),
    ],
  };
});

/**
 * The Remix plugin replaces `.client` modules with empty modules while it
 * builds for the server, so they never end up in the server bundle.
 *
 * The test run uses the same plugin, which would make the browser only
 * modules untestable. This plugin restores their original source, so they can
 * be unit tested with a stubbed browser environment.
 */
function restoreClientModulesPlugin() {
  const clientFileRE = /\.client(\.[cm]?[jt]sx?)?$/;
  const clientDirRE = /\/\.client\//;

  return {
    name: 'restore-client-modules-in-tests',
    async transform(code: string, id: string, options: { ssr?: boolean } | undefined) {
      if (!options?.ssr) {
        return undefined;
      }

      const [filepath] = id.split('?');

      if (!clientFileRE.test(filepath) && !clientDirRE.test(filepath)) {
        return undefined;
      }

      const source = await fs.readFile(filepath, 'utf8');

      const loader = filepath.endsWith('.tsx') ? 'tsx' : filepath.endsWith('.jsx') ? 'jsx' : 'ts';

      const result = await transformWithEsbuild(source, filepath, { loader, target: 'esnext' });

      return { code: result.code, map: result.map };
    },
  };
}

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );

            return;
          }
        }

        next();
      });
    },
  };
}
