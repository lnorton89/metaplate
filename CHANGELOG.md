# Changelog

All notable changes to Metaplate are documented in this file. The project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `metaplate/image`, reading dimensions from PNG, JPEG, and WebP headers, and
  `metaplate verify` now covering all three. A card encoded as JPEG or WebP
  through `output` stays inside the build check rather than silently leaving
  it. `metaplate/png` is unchanged for PNG-only checks.
- An `output` option on `createNodeOg` that takes a `contentType` and an
  `encode` function, so a plate can emit JPEG, WebP, or anything else while
  `render`, `response`, and `handler` carry the declared media type. Metaplate
  still ships no image encoder; the pair is declared together so the bytes and
  the media type cannot disagree.

## [0.3.0] - 2026-08-24

### Added

- `renderPixels` on `metaplate/node`, returning the raw RGBA pixmap so a
  consumer can encode a card as JPEG or WebP. A card compositing a photograph
  is several times larger as PNG, and returning the pixmap keeps an image
  encoder out of this package.

### Changed

- Report both renderer peers at once when `metaplate/node` has neither
  installed, rather than naming Satori, then Resvg on the following run.

## [0.2.1] - 2026-08-24

### Documentation

- Record that upgrading to 0.2.0 in place keeps Satori and Resvg on disk,
  because an installed package satisfies the now-optional peer, and that a
  clean reinstall is what reclaims the space. The note ships in the package so
  it reaches the npm page, where an upgrading consumer looks first.

## [0.2.0] - 2026-08-23

### Removed

- **Breaking:** The `ImageResponse` re-export from `metaplate/next`. Import it
  from `next/og` directly. The adapter now resolves `next/og` on first render,
  so the entry point imports in an install without Next and a missing peer
  reports its install command like every other peer.

### Fixed

- Attribute a failed optional-peer import to the package that is actually
  missing. A broken dependency tree inside an installed peer reports the same
  error code, so the install recipe could name a package the consumer already
  had.
- Reject a zero width or height in `metaplate verify --size` rather than
  reporting the mismatch it always produces against the file.

### Changed

- **Breaking:** Move `satori` and `@resvg/resvg-js` to optional peer
  dependencies. Metadata-only and Next.js installs no longer fetch Satori or
  Resvg's native binaries; consumers of `metaplate/render` and `metaplate/node`
  install them explicitly. The renderer resolves both packages on first use, so
  a missing peer reports its install command instead of failing at import.
- Show concise relative paths rather than ambiguous basenames in multi-file
  verifier output.

### Documentation

- Recommend rendering into `public/` and describing the file with
  `socialImageMetadata` for Next.js static exports under a `basePath`, and
  record why `app/opengraph-image.tsx` cannot serve that deployment shape.
- Document `createElement` as the build-script authoring form for projects
  without a JSX toolchain, including Satori's rule that array children need an
  explicit `display`.
- Warn that a page's `openGraph` replaces the layout's under Next's shallow
  metadata merge, and document a single `pageMetadata` composition in the
  README and the Next example — including the per-route `url` and an explicit
  `openGraph.title` — rather than a spread that drops layout-level fields.
- Record the plate constraints that surprise consumers: an inlined SVG
  `<title>` renders as visible text, and the React accessibility rules that ask
  for one do not apply to a plate.

## [0.1.2] - 2026-08-23

### Added

- Support repository and application subpath deployments through `basePath` in
  framework-neutral, Next.js, and standalone metadata helpers.
- Verify mixed PNG dimensions in one CLI invocation by repeating `--size`
  groups.

### Fixed

- Add default package-export conditions so CommonJS-based TypeScript runners
  can resolve every public entry point.

### Documentation

- Document build-time `opengraph-image.tsx` and public-PNG patterns for Next.js
  static exports, including `metadataBase` and a deployment `basePath`.

## [0.1.1] - 2026-08-23

### Fixed

- Make route and image-path slash trimming linear-time, preventing maliciously
  long inputs from causing polynomial regular-expression backtracking.
- Allow cold native PNG initialization enough time on Windows CI runners.

## [0.1.0] - 2026-08-23

### Added

- Framework-neutral Open Graph and Twitter metadata generation.
- Satori-based SVG rendering and Resvg-based PNG rendering for Node.js.
- Fetch API handlers and responses for Astro, SvelteKit, Remix, Express, and
  static build workflows.
- A Next.js `ImageResponse` adapter with predictable route metadata.
- Hoist-safe package font loading with memoized font bytes.
- PNG signature, header, and dimension verification through both the public API
  and the `metaplate verify` CLI.
- Typed package exports for framework-neutral, rendering, Node.js, Next.js,
  font, and PNG entry points.

[Unreleased]: https://github.com/lnorton89/metaplate/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/lnorton89/metaplate/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/lnorton89/metaplate/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/lnorton89/metaplate/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/lnorton89/metaplate/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/lnorton89/metaplate/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/lnorton89/metaplate/releases/tag/v0.1.0
