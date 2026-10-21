/**
 * Verifies that every icon class used in the source actually made it into the
 * production CSS bundle.
 *
 * UnoCSS silently skips a class it cannot resolve. That is a problem for icon
 * classes in particular: an icon name that does not exist in the collection, or
 * a class that lives in a module the UnoCSS content pipeline never scans,
 * produces no CSS rule at all and the icon renders as nothing. The build-mode
 * selector lost all four of its icons that way and nothing failed.
 *
 * This script closes that gap. It reads the built CSS and checks that every
 * `i-<collection>:<icon>` literal in the source has a matching rule.
 *
 * Run it with `pnpm run check:css` after `pnpm run build`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BUILD_ASSETS = join(ROOT, 'build', 'client', 'assets');
const SOURCE_DIRS = ['app', 'functions', 'scripts'];
const SOURCE_FILES = ['uno.config.ts', 'vite.config.ts'];
const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set(['node_modules', 'build', 'dist', '.git', '.cache', 'coverage']);

/** Matches the class names UnoCSS generates for icons, e.g. `i-ph:flask`. */
const ICON_CLASS = /\bi-([a-z0-9][a-z0-9-]*):([a-z0-9][a-z0-9-]*)\b/g;

/**
 * Escapes a class name the way UnoCSS writes it into the stylesheet, so it can
 * be searched for as a literal.
 */
function escapeClassName(className) {
  return className.replace(/([:.[\]%(),])/g, '\\$1');
}

async function collectSourceFiles(directory, files = []) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      await collectSourceFiles(fullPath, files);
      continue;
    }

    if (SCANNED_EXTENSIONS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

async function collectIcons() {
  const files = [];

  for (const directory of SOURCE_DIRS) {
    const fullPath = join(ROOT, directory);

    if (existsSync(fullPath)) {
      await collectSourceFiles(fullPath, files);
    }
  }

  for (const file of SOURCE_FILES) {
    const fullPath = join(ROOT, file);

    if (existsSync(fullPath)) {
      files.push(fullPath);
    }
  }

  const found = new Map();

  for (const file of files) {
    const contents = await readFile(file, 'utf8');

    for (const match of contents.matchAll(ICON_CLASS)) {
      const className = match[0];

      if (!found.has(className)) {
        found.set(className, new Set());
      }

      found.get(className).add(relative(ROOT, file).split(sep).join('/'));
    }
  }

  return found;
}

async function readBuiltCss() {
  if (!existsSync(BUILD_ASSETS)) {
    return null;
  }

  const files = (await readdir(BUILD_ASSETS)).filter((file) => file.endsWith('.css'));
  const chunks = await Promise.all(files.map((file) => readFile(join(BUILD_ASSETS, file), 'utf8')));

  return chunks.join('\n');
}

const icons = await collectIcons();
const css = await readBuiltCss();

if (css === null) {
  console.error('No build output found at build/client/assets.');
  console.error('Run "pnpm build" before running this check.');
  process.exit(1);
}

const missing = [];

for (const [className, sources] of [...icons.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  if (!css.includes(escapeClassName(className))) {
    missing.push({ className, sources: [...sources].sort() });
  }
}

if (missing.length > 0) {
  console.error(`Found ${missing.length} icon class(es) that are missing from the production CSS:\n`);

  for (const { className, sources } of missing) {
    console.error(`  ${className}`);
    console.error(`    used in: ${sources.join(', ')}`);
  }

  console.error('\nAn icon class without a CSS rule renders as nothing.');
  console.error('Check that the icon exists in the collection and that the file is covered by');
  console.error('the UnoCSS content pipeline (content.pipeline.include in uno.config.ts).');

  process.exit(1);
}

console.log(`All ${icons.size} icon classes are present in the production CSS.`);
