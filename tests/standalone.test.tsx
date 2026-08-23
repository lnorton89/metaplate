import { expect, it } from "vitest";
import { packageFontLoader } from "../src/fonts.js";
import { createNodeOg } from "../src/node.js";
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

it("renders PNG bytes without Next.js", async () => {
  const plate = createNodeOg(definition);
  expect(plate.contentType).toBe("image/png");
  const png = await plate.render({ title: "Node PNG" });
  verifyPng(png, plate.size);
});

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
