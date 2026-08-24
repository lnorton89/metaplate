import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  findPackageDirectory,
  loadPackageFonts,
  packageFontLoader,
} from "../src/fonts.js";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "metaplate-"));
  const packageDirectory = path.join(root, "node_modules", "@fontsource", "example");
  await mkdir(path.join(packageDirectory, "files"), { recursive: true });
  await writeFile(path.join(packageDirectory, "files", "example.woff"), Uint8Array.of(1, 2, 3));
  return { root, packageDirectory, nested: path.join(root, "apps", "site") };
}

describe("package fonts", () => {
  it("finds a hoisted scoped package by walking upward", async () => {
    const { packageDirectory, nested } = await fixture();
    expect(findPackageDirectory("@fontsource/example", nested)).toBe(packageDirectory);
  });

  it("loads a Satori-compatible font", async () => {
    const { root } = await fixture();
    const [font] = await loadPackageFonts(
      [{
        name: "Example",
        package: "@fontsource/example",
        file: "files/example.woff",
        weight: 700,
      }],
      { cwd: root },
    );
    expect(font?.name).toBe("Example");
    expect(new Uint8Array(font!.data)).toEqual(Uint8Array.of(1, 2, 3));
  });

  it("names every directory it searched when a package is missing", async () => {
    const { nested } = await fixture();
    expect(() => findPackageDirectory("@fontsource/absent", nested)).toThrow(
      /Cannot find @fontsource\/absent\. Looked in:/,
    );
  });

  it("memoizes a declared font set", async () => {
    const { root } = await fixture();
    const loader = packageFontLoader(
      [{
        name: "Example",
        package: "@fontsource/example",
        file: "files/example.woff",
        weight: 400,
      }],
      { cwd: root },
    );
    const spy = vi.fn(loader);
    expect(await spy()).toBe(await spy());
  });
});
