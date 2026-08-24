import path from "node:path";

export const VERIFY_USAGE =
  "Usage: metaplate verify --size WIDTHxHEIGHT <file> [...] [--size WIDTHxHEIGHT <file> [...]]";

export type VerifyTarget = {
  file: string;
  size: { width: number; height: number };
};

/** Formats a stable, concise path for CLI logs, including duplicate basenames. */
export function formatVerifyPath(file: string, cwd = process.cwd()): string {
  const relative = path.relative(cwd, path.resolve(cwd, file));
  return (relative || path.basename(file)).split(path.sep).join("/");
}

function parseSize(value: string | undefined) {
  const match = /^(\d+)x(\d+)$/.exec(value ?? "");
  if (!match) throw new Error(`Invalid size. ${VERIFY_USAGE}`);

  const size = { width: Number(match[1]), height: Number(match[2]) };
  // A PNG cannot declare a zero dimension, so accepting one only defers the
  // rejection to a dimension mismatch that blames the file.
  if (size.width === 0 || size.height === 0) {
    throw new Error(`Invalid size. ${VERIFY_USAGE}`);
  }

  return size;
}

/** Parses one or more size-delimited groups of PNG paths. */
export function parseVerifyTargets(args: string[]): VerifyTarget[] {
  if (args[0] !== "verify") throw new Error(VERIFY_USAGE);

  const targets: VerifyTarget[] = [];
  let size: VerifyTarget["size"] | undefined;

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--size") {
      size = parseSize(args[index + 1]);
      index += 1;
      continue;
    }
    if (!size || !argument) throw new Error(VERIFY_USAGE);
    targets.push({ file: argument, size });
  }

  if (targets.length === 0) throw new Error(VERIFY_USAGE);
  return targets;
}
