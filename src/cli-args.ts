export const VERIFY_USAGE =
  "Usage: metaplate verify --size WIDTHxHEIGHT <file.png> [...] [--size WIDTHxHEIGHT <file.png> [...]]";

export type VerifyTarget = {
  file: string;
  size: { width: number; height: number };
};

function parseSize(value: string | undefined) {
  const match = /^(\d+)x(\d+)$/.exec(value ?? "");
  if (!match) throw new Error(`Invalid size. ${VERIFY_USAGE}`);
  return { width: Number(match[1]), height: Number(match[2]) };
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
