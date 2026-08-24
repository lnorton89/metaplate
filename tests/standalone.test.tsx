import { createElement } from "react";
import { expect, it } from "vitest";
import { packageFontLoader } from "../src/fonts.js";
import { createNodeOg, type RenderedPixels } from "../src/node.js";
import { verifyPng } from "../src/png.js";
import { createSvgOg } from "../src/render.js";

const fonts = packageFontLoader([
  {
    name: "Inter",
    package: "@fontsource/inter",
    file: "files/inter-latin-700-normal.woff",
    weight: 700,
  },
]);

const definition = {
  alt: (copy: { title: string }) => `${copy.title} social card`,
  fonts,
  component: (copy: { title: string }) => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111111",
        color: "#ffffff",
        fontFamily: "Inter",
        fontWeight: 700,
        fontSize: 64,
      }}
    >
      {copy.title}
    </div>
  ),
} as const;

it("renders SVG without Next.js", async () => {
  const plate = createSvgOg(definition);
  expect(plate.contentType).toBe("image/svg+xml");
  const svg = await plate.renderSvg({ title: "Framework neutral" });
  expect(svg).toMatch(/^<svg/);
  expect(svg).toContain('width="1200"');
  expect(plate.metadata("/docs", { title: "Docs" }).openGraph.images[0]?.alt).toBe(
    "Docs social card",
  );
});

it(
  "renders PNG bytes without Next.js",
  async () => {
    const plate = createNodeOg(definition);
    expect(plate.contentType).toBe("image/png");
    const png = await plate.render({ title: "Node PNG" });
    verifyPng(png, plate.size);
  },
  // Loading the native renderer and fonts can exceed Vitest's five-second
  // default on a cold Windows runner; warmed renders remain much faster.
  20_000,
);

it("returns a Web Response usable by route-based frameworks", async () => {
  const plate = createNodeOg({
    ...definition,
    headers: { "Cache-Control": "public, max-age=3600" },
  });
  const response = await plate.response({ title: "HTTP response" });
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
  verifyPng(await response.arrayBuffer(), plate.size);
});

// The README documents `createElement` as the build-script authoring form for
// projects without a JSX toolchain, including its lone-string-child rule.
it("renders an element tree authored without JSX", async () => {
  const plate = createSvgOg({
    ...definition,
    component: (copy: { title: string }) =>
      createElement(
        "div",
        {
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            fontFamily: "Inter",
          },
        },
        createElement("div", { style: { fontSize: 32 } }, "Eyebrow"),
        createElement("div", { style: { fontSize: 64 } }, copy.title),
      ),
  });

  const svg = await plate.renderSvg({ title: "No JSX" });
  expect(svg).toMatch(/^<svg/);
  expect(svg).toContain('width="1200"');
});

it("requires at least one font", async () => {
  const plate = createSvgOg({ ...definition, fonts: () => [] });

  await expect(plate.renderSvg({ title: "No fonts" })).rejects.toThrow(
    /at least one font/,
  );
});

it(
  "renders raw RGBA pixels for another encoder",
  async () => {
    const plate = createNodeOg(definition);
    const { pixels, width, height } = await plate.renderPixels({ title: "Pixels" });

    expect(width).toBe(plate.size.width);
    expect(height).toBe(plate.size.height);
    expect(pixels.length).toBe(width * height * 4);
  },
  20_000,
);

// Dust Compass renders 1,513 cards through a six-way pool. Satori is a pure
// call and each render builds its own Resvg instance, so concurrent renders
// must agree with sequential ones rather than share mutable state.
it(
  "renders concurrently without sharing state",
  async () => {
    const plate = createNodeOg(definition);
    const copies = ["one", "two", "three", "four", "five", "six"].map((title) => ({
      title,
    }));

    const concurrent = await Promise.all(copies.map((copy) => plate.render(copy)));
    const sequential = [];
    for (const copy of copies) sequential.push(await plate.render(copy));

    for (const [index, bytes] of concurrent.entries()) {
      expect(Buffer.from(bytes).equals(Buffer.from(sequential[index]!))).toBe(true);
    }
    expect(Buffer.from(concurrent[0]!).equals(Buffer.from(concurrent[1]!))).toBe(false);
  },
  60_000,
);

it(
  "encodes with a supplied encoder and serves its media type",
  async () => {
    const encoded = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0);
    const seen: RenderedPixels[] = [];
    const plate = createNodeOg({
      ...definition,
      output: {
        contentType: "image/jpeg",
        encode: (image) => {
          seen.push(image);
          return encoded;
        },
      },
    });

    expect(plate.contentType).toBe("image/jpeg");
    expect(await plate.render({ title: "Encoded" })).toEqual(encoded);

    const response = await plate.response({ title: "Encoded" });
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(encoded);

    const image = seen[0]!;
    expect(image.pixels.length).toBe(image.width * image.height * 4);
  },
  20_000,
);

// The README promises row-major RGBA, and every consumer encoder is configured
// from that promise. A channel-order regression would leave dimensions correct
// and every card's colours wrong, so the bytes are asserted directly.
it(
  "returns pixels in row-major RGBA order",
  async () => {
    const plate = createNodeOg({
      ...definition,
      component: () => (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            background: "rgb(0,170,255)",
          }}
        />
      ),
    });

    const { pixels, width, height } = await plate.renderPixels({ title: "Colour" });
    const centre = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;

    expect(Array.from(pixels.slice(0, 4))).toEqual([0, 170, 255, 255]);
    expect(Array.from(pixels.slice(centre, centre + 4))).toEqual([0, 170, 255, 255]);
  },
  20_000,
);
