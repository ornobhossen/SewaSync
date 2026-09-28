/**
 * Make the static export portable.
 *
 * `next build` with `output: 'export'` emits every asset reference as a
 * root-absolute path (`/_next/static/...`). That only resolves when a server
 * hands the folder over at the domain root, so opening `index.html` straight
 * from disk, or mounting the export under a subpath, breaks two things:
 *
 *   1. The stylesheet link misses, and with no inline CSS as a fallback the
 *      result is unstyled markup.
 *   2. The `@font-face` rules inside that stylesheet point at
 *      `url(/_next/static/media/...)`, so even when the CSS *does* load every
 *      webfont 404s and all text silently falls back to a system face.
 *
 * This rewrites those references relative to each file's own directory, using
 * the same depth rule for HTML and CSS:
 *
 *   out/index.html                 ->  ./_next/static/...
 *   out/house/index.html           ->  ../_next/static/...
 *   out/_next/static/css/x.css     ->  url(../../../_next/static/media/...)
 *
 * Relative paths also resolve correctly when the export is served from the
 * domain root, so this is safe for the Vercel deployment as well.
 *
 * The JS chunks are deliberately left untouched. They address later chunks
 * against the site root, which is why navigation in the app is a real document
 * load rather than a client-side route transition (see `Pressable` in
 * components/ui.tsx) — each page loads only the chunks its own markup
 * references, and those references are relative.
 *
 * There is no service worker any more. A precache went stale the moment asset
 * URLs changed between builds, and it kept serving the previous broken
 * markup, which looked like intermittent breakage. The brief lists the
 * service worker as optional and the manifest as the requirement, so the
 * manifest alone carries installability.
 *
 * One addition: `next/font` does not preload the fonts it inlines into the
 * CSS, so the first paint blocks on a font request that is only discovered
 * after the stylesheet has been parsed. Each page here reads one face
 * immediately, so that face gets an explicit preload, emitted with the same
 * prefix as the other asset references.
 *
 * The other subtlety is `404.html`. Next renders the not-found route at
 * `/404/` and then copies that same document to `out/404.html` so static hosts
 * can serve it for unmatched requests. The copy is rendered with the depth of
 * its original location, so its links climb one directory further than they
 * should from the export root. That is corrected here.
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../out', import.meta.url));
const MEDIA_DIR = join(OUT_DIR, '_next', 'static', 'media');

/** Root-absolute asset prefixes, as a regex alternation body. */
const ASSETS =
  '_next/|manifest\\.webmanifest|apple-touch-icon\\.png|icon-192\\.png|icon-512\\.png|icon-maskable-512\\.png|icon-maskable\\.svg|icon\\.svg';

/** Files whose root-absolute references are rewritten. */
const TARGETS = /\.(?:html|css)$/;

/**
 * Swap the leading `/` of a root-absolute asset reference for `prefix`,
 * keeping the asset path itself intact.
 *
 * `"/_next/static/x.css"` -> `"../_next/static/x.css"`
 * `url(/_next/static/media/f.woff2)` -> `url(../_next/static/media/f.woff2)`
 */
function relativize(text, prefix) {
  return text
    .replace(
      new RegExp(`(["'])/(${ASSETS})`, 'g'),
      (_match, lead, asset) => `${lead}${prefix}${asset}`,
    )
    .replace(
      new RegExp(`url\\(\\s*(["']?)/(${ASSETS})`, 'g'),
      (_match, quote, asset) => `url(${quote}${prefix}${asset}`,
    );
}

/**
 * The font to preload.
 *
 * `next/font` subsets by unicode range and names each file with a content
 * hash, so no filename is hardcoded here. It marks the Latin subset with a
 * `.p.` infix (`636a5ac981f94f8b-s.p.woff2`); the other faces belong to
 * scripts this UI never renders, and preloading one of those would compete
 * with the app bundle for bandwidth. If that marker ever disappears, fall back
 * to the largest face rather than dropping the preload entirely.
 */
async function pickPreloadFont() {
  const names = (await readdir(MEDIA_DIR)).filter((name) => name.endsWith('.woff2'));
  const latin = names.find((name) => name.includes('.p.'));
  if (latin) return latin;

  let best = null;
  for (const name of names) {
    const { size } = await stat(join(MEDIA_DIR, name));
    if (!best || size > best.size) best = { name, size };
  }
  return best?.name ?? null;
}

/**
 * Add a font preload to an HTML file, unless it already has one.
 *
 * `crossOrigin` is required: the stylesheet requests the same file without
 * credentials, so a preload that omits it opens a second, unused connection.
 */
function preloadFont(html, font, prefix) {
  if (html.includes('rel="preload" as="font"')) return html;
  const tag =
    `<link rel="preload" as="font" type="font/woff2" crossorigin ` +
    `href="${prefix}_next/static/media/${font}">`;
  // Preload belongs in <head>; a document without one still parses, and the
  // charset declaration has to stay first regardless.
  if (html.includes('</head>')) return html.replace('</head>', `${tag}\n</head>`);
  if (html.includes('<head>')) return html.replace('<head>', `<head>\n${tag}`);
  return tag + html;
}

/**
 * Drop one `../` level from the links in the root-level `404.html` copy.
 *
 * Only the app's own routes need this. Asset references were already rewritten
 * above using this file's real depth, so they are correct, and the font
 * preload was emitted with the same. What is left one level too deep is the
 * navigation, which the app rendered for its `/404/` location.
 */
function fixRootNotFound(html) {
  return html.replace(/((?:href|src)=")(?:\.\.\/)+/g, (_match, lead) => `${lead}./`);
}

async function targetFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await targetFiles(full)));
    else if (TARGETS.test(entry.name)) found.push(full);
  }
  return found;
}

async function main() {
  let changed = 0;
  const total = { before: 0, after: 0 };
  const font = await pickPreloadFont();
  if (!font) console.log('no font found, skipping preload');

  for (const file of await targetFiles(OUT_DIR)) {
    const rel = relative(OUT_DIR, file);
    // out/house/index.html -> 1 segment of directory; out/x.css -> 0.
    const depth = rel.split(sep).length - 1;
    const prefix = depth === 0 ? './' : '../'.repeat(depth);

    const before = await readFile(file, 'utf8');
    let after = relativize(before, prefix);
    if (font && file.endsWith('.html')) after = preloadFont(after, font, prefix);
    // out/404.html is the root copy of out/404/index.html, so its app-rendered
    // links carry a `../` level that this file's own directory does not have.
    if (rel === '404.html') after = fixRootNotFound(after);

    if (after !== before) {
      await writeFile(file, after, 'utf8');
      changed += 1;
    }
    total.before += before.length;
    total.after += after.length;
  }

  console.log(
    `relativized ${changed} file(s) across ${total.after - total.before >= 0 ? '+' : ''}${total.after - total.before} bytes`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
