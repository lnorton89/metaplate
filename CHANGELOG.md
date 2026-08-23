# Changelog

All notable changes to Metaplate are documented in this file. The project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-08-23

### Changed

- **Breaking:** Move `satori` and `@resvg/resvg-js` to optional peer
  dependencies. Metadata-only and Next.js installs no longer fetch Satori or
  Resvg's native binaries; consumers of `metaplate/render` and `metaplate/node`
  install them explicitly. The renderer resolves both packages on first use, so
  a missing peer reports its install command instead of failing at import.
- Show concise relative paths rather than ambiguous basenames in multi-file
  verifier output.

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

[Unreleased]: https://github.com/lnorton89/metaplate/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/lnorton89/metaplate/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/lnorton89/metaplate/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/lnorton89/metaplate/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/lnorton89/metaplate/releases/tag/v0.1.0
