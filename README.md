# SewaSync

> **Demo / portfolio project — not a real product.**
> SewaSync is a fictional shared-housing bill-splitting experience built as a
> web development project. It is **not** a real business or product, is not
> affiliated with any real landlord, property, or utility provider, and does not
> process real bills, payments, or personal data. All houses, rooms, members,
> bills, payments, reminders, and repair tickets are simulated for
> demonstration purposes only.

Shared student housing coordination for Malaysian off-campus rentals. Fair bills,
no awkward reminders.

This is the **Next.js source**. The runnable, already-built static site is a
separate archive (`sewasync-app.zip`); you only need this one if you want to
change the code and rebuild.

## Requirements

- Node.js 20 or newer (18.18+ works, 20+ is recommended)
- npm 10 or newer

## Getting started

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:3000
```

## Build the static site

```bash
npm run build
```

This produces a fully static export in `out/`. It runs from disk with no server
and no network access: unzip it anywhere and open `out/index.html`.

`npm run build` runs two steps, and **both are required**:

1. `next build` — prerenders every route into `out/`
2. `node scripts/relativize-export.mjs` — post-processes the export

The second step is not optional. It rewrites asset references to relative paths,
injects the Latin font preload, and corrects the link depth in the root-level
`404.html`. Running `next build` on its own produces an export whose links break
when the site is served from anything other than a domain root.

## Type checking

```bash
npm run typecheck
```

## Deploying

`out/` is a plain static directory — any static host works: Vercel, Netlify,
GitHub Pages, S3, nginx.

`vercel.json` is included and already points Vercel at `out/`.

### One caveat about `manifest.webmanifest`

The generated manifest uses root-absolute paths for `id`, `start_url`, `scope`,
and its icons. If you deploy to a **subdirectory** (for example
`example.com/sewasync/`), the "install as app" prompt will point at the wrong
place. Serving from a domain root is fine, and so is opening from `file://` —
the manifest is only read at install time, so nothing else is affected.

## Project structure

```
app/            routes — one folder per screen, each with a page.tsx
  globals.css   global styles and design tokens
  layout.tsx    root layout: fonts, metadata, app shell
  manifest.ts   generates manifest.webmanifest
components/     shared UI — buttons, cards, bottom nav, common pieces
lib/
  routes.ts     depth-relative href helper (see below)
  store.tsx     client-side state and persistence
  seed.ts       demo data
  i18n.ts       copy and formatting
  money.ts      currency formatting
  dates.ts      date helpers
  allocate.ts   bill splitting logic
  selectors.ts  derived state
  types.ts      shared types
scripts/
  relativize-export.mjs   export post-processor (see "Build" above)
public/         icons and PWA assets
```

## A note on navigation

The app uses plain `<a>` document loads rather than `next/link`, and every
internal href goes through `relativeHref()` in `lib/routes.ts`. That helper
converts a route like `/bills/` into the file the build actually emits —
`../bills/index.html` — relative to the current page's depth.

Do not hand-write internal hrefs as `/bills/`. Root-absolute paths escape the
project when the site is not served from a domain root, and directory-style
relative paths fail when the host tries to read them as files. If you need a
new internal link, use the `Button` / `IconButton` / `Pressable` components or
wrap the href with `useRelHref()`.

## Disclaimer

SewaSync is a **fictional demo**. The house, rooms, members, landlord, bills,
prices, payments, reminders, and repair tickets shown are examples only. Nothing
in this repository is a real product, service, or commercial offering. Do not
use it to process real payments or personal data.

## License

This project is provided for educational and portfolio purposes. Add a license
of your choice before redistributing.
