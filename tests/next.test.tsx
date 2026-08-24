import { expect, it } from "vitest";
import { createNextOg } from "../src/next.js";
import { verifyPng } from "../src/png.js";

it("renders a real PNG through Next ImageResponse", async () => {
  const plate = createNextOg<{ title: string; alt: string }>({
    alt: (copy) => copy.alt,
    component: (copy) => (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111111",
          color: "#ffffff",
          fontSize: 64,
        }}
      >
        {copy.title}
      </div>
    ),
  });

  const response = await plate.render({ title: "Metaplate", alt: "Metaplate card" });
  expect(response.headers.get("content-type")).toBe("image/png");
  verifyPng(await response.arrayBuffer(), plate.size);
});

it("keeps route and metadata helpers on the same definition", () => {
  const plate = createNextOg<{ alt: string }>({
    alt: (copy) => copy.alt,
    component: () => <div style={{ display: "flex" }}>Card</div>,
    imagePath: "social-image",
    basePath: "/project",
  });

  const copy = { alt: "A card" };
  expect(plate.image("/docs", copy).url).toBe("/project/docs/social-image");
  expect(plate.metadata("/docs", copy).twitter.images[0]?.alt).toBe("A card");
});

it("returns a route handler bound to one copy", async () => {
  const plate = createNextOg<{ title: string; alt: string }>({
    alt: (copy) => copy.alt,
    component: (copy) => (
      <div style={{ width: "100%", height: "100%", display: "flex", fontSize: 48 }}>
        {copy.title}
      </div>
    ),
  });

  const GET = plate.handler({ title: "Route", alt: "Route card" });
  const response = await GET();

  expect(response.headers.get("content-type")).toBe("image/png");
  verifyPng(await response.arrayBuffer(), plate.size);
});
