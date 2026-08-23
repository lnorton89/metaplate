# Metaplate

Composable, verifiable Open Graph image tooling for Next.js.

Metaplate turns one branded JSX plate into a consistent system: an
`ImageResponse` renderer, predictable route handlers, matching Open Graph and
Twitter metadata, package-based font loading, and PNG dimension checks.

## Why

Next's `opengraph-image.tsx` convention is convenient, but a normal route
handler gives static deployments a stable URL (`/roadmap/og-image`) and keeps
rendering logic in one place. Metaplate supports that pattern without owning
your design. Your application supplies the JSX and page copy; the package owns
the repetitive wiring.

## Install

```sh
npm install metaplate
```

`next` and `react` are optional peer dependencies. The metadata and PNG helpers
work without them.

## Define the plate

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
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        background: "#111",
        color: "#fff",
        padding: 72,
      }}
    >
      <span style={{ fontSize: 20 }}>{copy.eyebrow}</span>
      <span style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 72 }}>
        {copy.title}
      </span>
      <span style={{ display: "flex", fontSize: 28 }}>{copy.description}</span>
    </div>
  ),
});
```

Satori accepts TTF, OTF, and WOFF fonts, not WOFF2. `packageFontLoader` walks
upward through `node_modules`, so it works when a font package is hoisted to a
workspace root. It also memoizes the bytes during development.

## Wire a route

Keep the copy next to the page metadata, then reuse the same object in the
route handler:

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

```tsx
// src/app/roadmap/og-image/route.tsx
import { og } from "@/lib/og";
import { copy } from "../page";

export const dynamic = "force-static";
export const GET = og.handler(copy);
```

The resulting metadata points both `og:image` and `twitter:image` at
`/roadmap/og-image`, declares the configured dimensions, includes alt text, and
sets Twitter's large-card type.

For Next's file convention, call `og.render(copy)` from the default export and
re-export `og.size` and `og.contentType` as the convention constants.

## Static hosts

An extension-free route may be served as a generic download by a static host.
Set `Content-Type: image/png` explicitly for `/og-image` and `/*/og-image`.
For Netlify:

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

Or use `verifyPng` from `metaplate/png` in a test.

## API

- `metaplate` — constants, stable path construction, and metadata helpers.
- `metaplate/next` — `createNextOg` and `ImageResponse`.
- `metaplate/fonts` — hoist-safe package font loading and memoization.
- `metaplate/png` — PNG header inspection and dimension verification.

## Design lineage

Metaplate extracts the repeated production pattern from GOLC Site and the
Cinnabar site. It also supports the pre-rendered static-image pattern used by
the AntikytheraOS showcase through its PNG verifier and framework-independent
metadata helpers.

## License

MIT
