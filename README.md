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

For a branded image generated during `next build`, use Next's special
`app/opengraph-image.tsx` file shown above and set `dynamic = "force-static"`.
Next can prerender that `ImageResponse` when `output: "export"` is enabled.

If the image is generated outside Next and lives in `public`, use the
framework-neutral metadata helper instead:

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

This emits `/project/og-image.png`; Next resolves it against `metadataBase`.
Verify both `public/og-image.png` and the copied `out/og-image.png`, and inspect
the exported HTML to confirm its social tags contain the deployment prefix.

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
