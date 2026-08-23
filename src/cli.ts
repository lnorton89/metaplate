#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import process from "node:process";
import { verifyPng } from "./png.js";

const usage = "Usage: metaplate verify --size WIDTHxHEIGHT <file.png> [...]";

function parseSize(value: string | undefined) {
  const match = /^(\d+)x(\d+)$/.exec(value ?? "");
  if (!match) throw new Error(`Invalid size. ${usage}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

async function main(args: string[]) {
  if (args[0] !== "verify") throw new Error(usage);
  const sizeIndex = args.indexOf("--size");
  if (sizeIndex < 0) throw new Error(usage);

  const size = parseSize(args[sizeIndex + 1]);
  const files = args.filter(
    (argument, index) => index > 0 && index !== sizeIndex && index !== sizeIndex + 1,
  );
  if (files.length === 0) throw new Error(usage);

  for (const file of files) {
    const bytes = await readFile(file);
    verifyPng(bytes, size);
    process.stdout.write(`✓ ${basename(file)} ${size.width}x${size.height}\n`);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
