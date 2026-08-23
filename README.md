# Metaplate

[![CI](https://github.com/lnorton89/metaplate/actions/workflows/ci.yml/badge.svg)](https://github.com/lnorton89/metaplate/actions/workflows/ci.yml)
[![CodeQL](https://github.com/lnorton89/metaplate/actions/workflows/codeql.yml/badge.svg)](https://github.com/lnorton89/metaplate/actions/workflows/codeql.yml)
[![npm](https://img.shields.io/npm/v/metaplate)](https://www.npmjs.com/package/metaplate)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Composable, framework-neutral Open Graph image tooling for TypeScript.

Metaplate turns one branded JSX plate into a consistent image system: SVG and
PNG rendering, Fetch API responses, predictable image URLs, matching Open Graph
and Twitter metadata, package-based font loading, and PNG verification. It
works with plain Node, Astro, SvelteKit, Remix, Express, static build scripts,
and Next.js.

## Install

Metaplate has no runtime dependencies of its own. Each entry point declares the
peers it needs, so metadata-only and Next.js projects never download Satori or
Resvg's platform-specific binaries.

For metadata, or for Next.js where `next` and `react` are already supplied by
the application:

```sh
npm install metaplate
```

For framework-neutral PNG rendering with `metaplate/node`:

```sh
npm install metaplate satori @resvg/resvg-js react
```

For SVG-only rendering with `metaplate/render`, Resvg is unnecessary:

```sh
npm install metaplate satori react
```

### Optional peers

`satori` and `@resvg/resvg-js` load on the first render rather than at import
time, so the standalone entry points import cleanly in a lean install. A render
without them reports the package to install:

```
Cannot find satori, required by metaplate/render and metaplate/node.
Install it with: npm install satori
```

Through 0.1.x both packages were ordinary dependencies. Standalone consumers
upgrading from those versions should add them to their own `package.json`;
nothing changes for metadata-only and Next.js consumers.

## Framework-neutral renderer

Define the design once with `createNodeOg`. The component is Satori-compatible
JSX, not browser DOM, so containers with multiple children should use flex.

```tsx
// src/lib/og.tsx
import { packageFontLoader } from "metaplate/fonts";
import { createNodeOg } from "metaplate/node";

export const og = createNodeOg<{ title: string; alt: string }>({
  alt: (copy) => copy.alt,
  fonts: packageFontLoader([
    {
      name: "Inter",
      package: "@fontsource/inter",
      file: "files/inter-latin-700-normal.woff",
      weight: 700,
    },
  ]),
  headers: { "Cache-Control": "public, max-age=86400" },
  component: (copy) => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        background: "#111",
        color: "#fff",
        fontFamily: "Inter",
        fontSize: 72,
        padding: 72,
      }}
    >
      {copy.title}
    </div>
  ),
});
```

The resulting plate supports three output forms:

```ts
const png: Uint8Array = await og.render(copy);
const svg: string = await og.renderSvg(copy);
const response: Response = await og.response(copy);
```

### Astro, SvelteKit, Remix, and other Fetch-based routes

`handler` returns a standard Fetch API handler. For an Astro endpoint:

```ts
// src/pages/og-image.png.ts
import { og } from "../lib/og";

export const prerender = true;
export const GET = og.handler({ title: "An Astro site", alt: "Astro card" });
```

The same handler shape works in SvelteKit and other route systems that return a
Web `Response`.

### Express and build scripts

Express can send the raw PNG returned by `render`. Static generators can write
the same bytes into `public/` during a build:

```ts
import { writeFile } from "node:fs/promises";
import { og } from "./og.js";

await writeFile("public/og.png", await og.render(copy));
```

### Authoring without a JSX toolchain

A plain `.mjs` build script has no JSX transform, and adding one to render a
social card is rarely worth it. `component` accepts the element tree Satori
walks, so `createElement` is enough:

```js
// scripts/build-og.mjs
import { writeFile } from "node:fs/promises";
import { createElement as h } from "react";
import { packageFontLoader } from "metaplate/fonts";
import { createNodeOg } from "metaplate/node";

const og = createNodeOg({
  alt: (copy) => copy.alt,
  fonts: packageFontLoader([
    {
      name: "Inter",
      package: "@fontsource/inter",
      file: "files/inter-latin-700-normal.woff",
      weight: 700,
    },
  ]),
  component: (copy) =>
    h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#111",
          color: "#fff",
          fontFamily: "Inter",
          padding: 72,
        },
      },
      h("div", { style: { fontSize: 32 } }, copy.eyebrow),
      h("div", { style: { fontSize: 72 } }, copy.title),
    ),
});

await writeFile("public/og-image.png", await og.render(copy));
```

Satori requires an explicit `display` on any element whose `children` is an
array, including a single-element array. Pass a lone text child as a string,
`h("div", style, "Roadmap")`, not `h("div", style, ["Roadmap"])`. The array
form fails with:

```
Expected <div> to have explicit "display: flex", "display: contents",
or "display: none" if it has more than one child node.
```

That message names the containing element and its child count, but the element
to fix is the leaf holding the array. Scripts that build children
programmatically should either spread the array into `createElement` or give
that element an explicit `display`.

The same tree can be written as plain `{ type, props }` objects when React is
not installed at all, which is what the standalone package verification does.

### SVG-only rendering

Use `createSvgOg` from `metaplate/render` when the consumer only needs SVG and
should not install Resvg's native Node binding.

## Next.js adapter

Next applications can use the native `next/og` pipeline while keeping the same
route and metadata pattern:

```tsx
// src/lib/og.tsx
import { packageFontLoader } from "metaplate/fonts";
import { createNextOg } from "metaplate/next";

export type OgCopy = {
  eyebrow: string;
  title: string;
  description: string;
  alt: string;
};

export const og = createNextOg<OgCopy>({
  alt: (copy) => copy.alt,
  fonts: packageFontLoader([
    {
      name: "Inter",
      package: "@fontsource/inter",
      file: "files/inter-latin-700-normal.woff",
      weight: 700,
    },
  ]),
  component: (copy) => (
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      {copy.title}
    </div>
  ),
});
```

Keep the copy next to the page metadata:

```tsx
// src/app/roadmap/page.tsx
import { og } from "@/lib/og";

export const copy = {
  eyebrow: "What comes next",
  title: "Roadmap",
  description: "A dependency-ordered view of the work ahead.",
  alt: "Project roadmap",
};

export const metadata = {
  title: copy.title,
  description: copy.description,
  ...og.metadata("/roadmap", copy),
};
```

Then expose the predictable route:

```tsx
// src/app/roadmap/og-image/route.tsx
import { og } from "@/lib/og";
import { copy } from "../page";

export const dynamic = "force-static";
export const GET = og.handler(copy);
```

For Next's `opengraph-image.tsx` convention, call `og.render(copy)` from the
default export and re-export `og.size` and `og.contentType` as its constants.
That convention assumes a root-deployed app; see
[Next.js static export and `basePath`](#nextjs-static-export-and-basepath)
before using it behind a deployment prefix.

## Metadata without a renderer

The root `metaplate` entry has no framework dependency. It can describe a
hand-authored or pre-rendered image, like a conventional `public/og.png`:

```ts
import { socialImageMetadata } from "metaplate";

const metadata = socialImageMetadata("/", "Project home card", {
  imagePath: "og.png",
  size: { width: 1200, height: 630 },
});
```

### Next.js static export and `basePath`

Next's special `app/opengraph-image.tsx` file suits a root-deployed app: set
`dynamic = "force-static"` and Next prerenders the `ImageResponse` during
`next build` with `output: "export"` enabled.

Under a deployment `basePath`, that file still prerenders and the build still
reports success, but the card is unusable for two independent reasons:

- **The emitted file has no extension.** `out/opengraph-image` holds PNG bytes
  with nothing to tell a static host so. The
  [Static hosts](#static-hosts) section fixes that for route handlers with
  per-path headers, which GitHub Pages project sites cannot set at all.
- **The emitted metadata drops the prefix.** Next resolves special-file
  metadata against `metadataBase` without applying `basePath`, so the tag reads
  `https://example.github.io/opengraph-image` and 404s on a project site. The
  build stays green, so this surfaces only once a crawler follows the link.

Under `basePath`, render the card into `public/` during the build instead, as
in [Authoring without a JSX toolchain](#authoring-without-a-jsx-toolchain), and
describe the result with the framework-neutral metadata helper:

```ts
// app/layout.tsx
import type { Metadata } from "next";
import { socialImageMetadata } from "metaplate";

const social = socialImageMetadata("/", "Project home card", {
  basePath: "/project",
  imagePath: "og-image.png",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://example.github.io"),
  openGraph: social.openGraph,
  twitter: social.twitter,
};
```

This emits `/project/og-image.png`, which Next resolves against
`metadataBase` into
`https://example.github.io/project/og-image.png`. Verify both
`public/og-image.png` and the copied `out/og-image.png`, and inspect the
exported HTML to confirm its social tags carry the deployment prefix.

## Fonts

Satori needs real font bytes and accepts TTF, OTF, and WOFF, but not WOFF2.
`packageFontLoader` reads faces from installed packages and walks upward through
`node_modules`, so hoisted workspace dependencies work. It memoizes the bytes
for repeated development requests.

## Static hosts

Extension-free route-handler output may be served as a generic download by a
static host. Set `Content-Type: image/png` explicitly for `/og-image` and
`/*/og-image`. For Netlify:

```toml
[[headers]]
for = "/og-image"
  [headers.values]
  Content-Type = "image/png"

[[headers]]
for = "/*/og-image"
  [headers.values]
  Content-Type = "image/png"
```

## Verify generated files

Metaplate checks the PNG signature, IHDR chunk, and dimensions without decoding
the entire image:

```sh
npx metaplate verify --size 1200x630 public/og.png
```

Files of different sizes can be checked in one invocation by repeating the
size group:

```sh
npx metaplate verify \
  --size 1200x630 public/og.png public/about.png \
  --size 512x512 public/icon-512.png
```

Or import `verifyPng` from `metaplate/png` in a test.

## Entry points

- `metaplate` — framework-free paths, dimensions, and metadata. No peers.
- `metaplate/render` — Satori-based SVG generation. Needs `satori`.
- `metaplate/node` — SVG and PNG generation plus Fetch API responses. Needs
  `satori` and `@resvg/resvg-js`.
- `metaplate/next` — native Next.js `ImageResponse` adapter. Needs `next`.
- `metaplate/fonts` — hoist-safe package font loading and memoization. No peers.
- `metaplate/png` — PNG header inspection and dimension verification. No peers.

## Design lineage

Metaplate extracts the production patterns used by the GOLC and Cinnabar sites
and the pre-rendered static-image pattern used by the AntikytheraOS showcase.

## License

MIT
