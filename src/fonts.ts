import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type FontWeight =
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900;

export type PackageFont = {
  name: string;
  package: string;
  /** Path relative to the package directory, such as `files/font-latin-700-normal.woff`. */
  file: string;
  weight: FontWeight;
  style?: "normal" | "italic";
};

export type LoadedFont = {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: "normal" | "italic";
};

/** Walks upward through node_modules so hoisted workspace dependencies work. */
export function findPackageDirectory(packageName: string, cwd = process.cwd()): string {
  const searched: string[] = [];
  let directory = path.resolve(cwd);

  for (;;) {
    const candidate = path.join(directory, "node_modules", packageName);
    searched.push(candidate);
    if (existsSync(candidate)) return candidate;

    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  throw new Error(
    `Cannot find ${packageName}. Looked in:\n  ${searched.join("\n  ")}`,
  );
}

/** Loads Satori-compatible TTF, OTF, or WOFF faces from installed packages. */
export async function loadPackageFonts(
  fonts: readonly PackageFont[],
  options: { cwd?: string } = {},
): Promise<LoadedFont[]> {
  return Promise.all(
    fonts.map(async (font) => {
      const directory = findPackageDirectory(font.package, options.cwd);
      const bytes = await readFile(path.join(directory, font.file));
      const data = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;

      return {
        name: font.name,
        data,
        weight: font.weight,
        style: font.style ?? "normal",
      };
    }),
  );
}

/** Memoizes a font set so repeated development requests do not reread files. */
export function packageFontLoader(
  fonts: readonly PackageFont[],
  options: { cwd?: string } = {},
): () => Promise<LoadedFont[]> {
  let loaded: Promise<LoadedFont[]> | undefined;
  return () => {
    loaded ??= loadPackageFonts(fonts, options);
    return loaded;
  };
}
