'use client';

import { useCallback } from 'react';
import { usePathname } from 'next/navigation';

/* ------------------------------------------------------------------ */
/* internal navigation on a static export                              */
/* ------------------------------------------------------------------ */

/**
 * SewaSync ships as a fully static export, so there is no server to stream a
 * route from: every in-app link is a real document load. That only works if
 * the link points at a file that sits next to the current one.
 *
 * A root-absolute `/bills/` leaves the export. Where the export is not mounted
 * at a domain root — opened as a single-file artifact, served under a subpath,
 * or read straight off disk — `/bills/` resolves against the host instead of
 * against the project, lands on whatever the host serves at its root, and the
 * page appears to reopen itself. That is the whole "every button shows me this
 * page" failure, and it is a URL problem, not a router problem: there is no
 * `next/link` in this app for exactly the reason `Pressable` documents.
 *
 * So internal hrefs are made depth-relative: from `/bills/b-rent/` the target
 * `/bills/b-tnb/` is written `../../bills/b-tnb/index.html`, which resolves to
 * the same file whether the export is at the domain root, under a subpath, or
 * on disk.
 *
 * They name the file, not the directory. A trailing-slash URL such as
 * `../../bills/` only resolves if the host serves a directory index, and this
 * one does not: it takes the resolved path and reads it, so a directory fails
 * with `EISDIR` instead of loading. `next build --output export` writes every
 * route as `<route>/index.html`, so that is the path the href has to name.
 * Naming the file is what a real static host does anyway, and it is the only
 * form that survives being opened straight off disk.
 *
 * The segment count comes from the prerendered route, which the server render
 * and the hydrated client read identically, so the markup React hydrates never
 * disagrees with the markup that shipped. It is deliberately not derived from
 * `window.location`: a mount prefix would make the two renders differ.
 *
 * Absolute URLs, protocol-relative URLs, and bare fragments pass through
 * untouched.
 */

/**
 * Turn a root-absolute app href into a file path relative to `fromPathname`.
 *
 * The query and fragment are split off first and reattached untouched, so
 * `/bills/view/?id=b-rent` becomes `../bills/view/index.html?id=b-rent` rather
 * * than trying to write a file called `view/?id=b-rent`.
 *
 * In development (`next dev`), the dev server serves routes without `index.html`.
 * In static export, files are named `index.html`. We detect the environment at
 * runtime by checking if the current page is an `.html` file or on `file:` protocol.
 */
export function relativeHref(href: string, fromPathname: string, isStaticExport = false): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;

  const suffixAt = href.search(/[?#]/);
  const route = suffixAt === -1 ? href : href.slice(0, suffixAt);
  const suffix = suffixAt === -1 ? '' : href.slice(suffixAt);

  const depth = fromPathname.split('/').filter(Boolean).length;
  const prefix = depth === 0 ? './' : '../'.repeat(depth);

  // `/` -> `./index.html` (static) or `./` (dev), `/bills/` -> `../bills/index.html` (static) or `../bills/` (dev).
  const target = route.endsWith('/') ? route : `${route}/`;
  const suffixHtml = isStaticExport ? 'index.html' : '';
  return `${prefix}${target.slice(1)}${suffixHtml}${suffix}`;
}

/**
 * The same rewrite, bound to the current route. Use it for anything rendered
 * into `href`; it is also safe to call at click time for `location.assign`.
 *
 * The result is memoised so it can be used as an effect dependency: without
 * that, every render hands back a new function and an effect keyed on it
 * re-runs on every render.
 */
export function useRelHref(): (href: string) => string {
  // `usePathname` returns the prerendered route, e.g. `/bills/b-rent/`. The
  // fallback only applies to the not-found route, which has no tabs to light.
  const pathname = usePathname() ?? '/';

  // Detect static export at runtime: true if on file:// protocol or path ends with .html
  const isStaticExport = typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' || window.location.pathname.endsWith('.html'));

  return useCallback(
    (href: string) => relativeHref(href, pathname, isStaticExport),
    [pathname, isStaticExport],
  );
}

/**
 * Compare two app paths, ignoring the mount prefix, the `index.html` a static
 * server may or may not rewrite, any query, and a trailing slash.
 *
 * `window.location.pathname` carries whatever prefix the export is mounted
 * under, so `pathname === href` can never be true once it is not at the root.
 * Resolving the tab href against the real document URL puts both sides in the
 * same coordinate space.
 */
export function isCurrentPath(href: string, pathname: string): boolean {
  const normalise = (path: string) => {
    const [bare] = path.split(/[?#]/);
    const trimmed = bare.replace(/\/index\.html$/, '/').replace(/\/+$/, '');
    return trimmed === '' ? '/' : trimmed;
  };
  return normalise(href) === normalise(pathname);
}
