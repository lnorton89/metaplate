import { describe, expect, it } from "vitest";
import {
  OG_SIZE,
  socialImage,
  socialImageMetadata,
  socialImagePath,
} from "../src/index.js";

describe("socialImagePath", () => {
  it.each([
    ["/", "/og-image"],
    ["roadmap", "/roadmap/og-image"],
    ["/learn/borrowing/", "/learn/borrowing/og-image"],
  ])("maps %s to %s", (route, expected) => {
    expect(socialImagePath(route)).toBe(expected);
  });

  it("supports a custom stable path", () => {
    expect(socialImagePath("/docs", "/social/card")).toBe("/docs/social/card");
  });

  it("prefixes routes with a deployment base path", () => {
    expect(socialImagePath("/docs", "og-image.png", "/project/")).toBe(
      "/project/docs/og-image.png",
    );
  });

  it("rejects an empty image path", () => {
    expect(() => socialImagePath("/docs", "///")).toThrow(/imagePath/);
  });

  it("handles long slash-delimited input in linear time", () => {
    const padding = "/".repeat(100_000);
    expect(socialImagePath(`${padding}docs${padding}`, `${padding}card${padding}`)).toBe(
      "/docs/card",
    );
  });
});

it("builds a standard image descriptor", () => {
  expect(socialImage("/roadmap", "Roadmap card")).toEqual({
    url: "/roadmap/og-image",
    width: OG_SIZE.width,
    height: OG_SIZE.height,
    alt: "Roadmap card",
  });
});

it("builds a descriptor for a subpath deployment", () => {
  expect(
    socialImage("/guides", "Guides card", {
      basePath: "/project",
      imagePath: "og-image.png",
    }).url,
  ).toBe("/project/guides/og-image.png");
});

it("reuses one descriptor for Open Graph and Twitter metadata", () => {
  const metadata = socialImageMetadata("/", "Home card");
  expect(metadata.twitter.card).toBe("summary_large_image");
  expect(metadata.twitter.images[0]).toEqual(metadata.openGraph.images[0]);
});
