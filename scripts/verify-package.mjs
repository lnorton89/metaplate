import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const temporary = mkdtempSync(join(tmpdir(), "metaplate-package-"));
const consumer = join(temporary, "consumer");
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error("Run package verification through `npm run check:package`.");
}

function run(args, options = {}) {
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  });
}

try {
  const packed = JSON.parse(
    run(["pack", "--json", "--pack-destination", temporary]),
  );
  const archive = join(temporary, packed[0].filename);
  const paths = new Set(packed[0].files.map((file) => file.path));
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

  if (!paths.has(manifest.bin.metaplate.replace(/^\.\//, ""))) {
    throw new Error(`Package is missing its CLI entry: ${manifest.bin.metaplate}`);
  }

  for (const [entry, target] of Object.entries(manifest.exports)) {
    for (const kind of ["types", "import"]) {
      const path = target[kind].replace(/^\.\//, "");
      if (!paths.has(path)) {
        throw new Error(`Package export ${entry} is missing its ${kind} file: ${path}`);
      }
    }
  }

  writeFileSync(
    join(temporary, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  run(
    [
      "install",
      archive,
      "--prefix",
      consumer,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    { cwd: temporary },
  );

  const smoke = [
    'await import("metaplate");',
    'await import("metaplate/render");',
    'await import("metaplate/node");',
    'await import("metaplate/fonts");',
    'await import("metaplate/png");',
  ].join("\n");
  execFileSync(process.execPath, ["--input-type=module", "--eval", smoke], {
    cwd: consumer,
    stdio: "inherit",
  });

  const cli = spawnSync(
    process.execPath,
    [join(consumer, "node_modules", "metaplate", "dist", "cli.js")],
    { cwd: consumer, encoding: "utf8" },
  );
  if (cli.status !== 1 || !cli.stderr.includes("Usage: metaplate verify")) {
    throw new Error("Installed CLI did not return its expected usage error.");
  }

  process.stdout.write(
    `Verified ${packed[0].filename} exports, CLI, and consumer install.\n`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
