#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import process from "node:process";
import { parseVerifyTargets } from "./cli-args.js";
import { verifyPng } from "./png.js";

async function main(args: string[]) {
  for (const { file, size } of parseVerifyTargets(args)) {
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
