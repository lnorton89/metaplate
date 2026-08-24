import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const temporary = mkdtempSync(join(tmpdir(), "metaplate-package-"));
const consumer = join(temporary, "consumer");
const standalone = join(temporary, "standalone");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
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

function install(directory, specifiers) {
  run(
    [
      "install",
      ...specifiers,
      "--prefix",
      directory,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    { cwd: temporary },
  );
}

function runModule(source, cwd) {
  execFileSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd,
    stdio: "inherit",
  });
}

/** Installs the peer version this repository already pins and tests against. */
function peerSpecifier(name) {
  const range = manifest.devDependencies[name];
  if (!range) throw new Error(`No pinned range available to install ${name}.`);
  return `${name}@${range}`;
}

try {
  const packed = JSON.parse(
    run(["pack", "--json", "--pack-destination", temporary]),
  );
  const archive = join(temporary, packed[0].filename);
  const paths = new Set(packed[0].files.map((file) => file.path));

  if (!paths.has(manifest.bin.metaplate.replace(/^\.\//, ""))) {
    throw new Error(`Package is missing its CLI entry: ${manifest.bin.metaplate}`);
  }

  for (const [entry, target] of Object.entries(manifest.exports)) {
    for (const kind of ["types", "import", "default"]) {
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

  // Shape one: metadata-only and Next.js consumers, which must never resolve
  // the standalone renderer or its native binaries.
  install(consumer, [archive]);

  for (const peer of ["satori", "@resvg/resvg-js", "next"]) {
    if (existsSync(join(consumer, "node_modules", peer))) {
      throw new Error(`A lean install pulled the optional peer ${peer}.`);
    }
  }

  const smoke = `
    await import("metaplate");
    await import("metaplate/render");
    await import("metaplate/node");
    await import("metaplate/next");
    await import("metaplate/fonts");
    await import("metaplate/png");
  `;
  runModule(smoke, consumer);

  // Standalone entry points load without their peers; only rendering needs
  // them, and it has to say which package to install.
  const guidance = `
    const { createSvgOg } = await import("metaplate/render");
    const plate = createSvgOg({
      component: () => null,
      alt: () => "card",
      fonts: () => [],
    });

    try {
      await plate.renderSvg({});
    } catch (error) {
      if (!error.message.includes("npm install satori")) throw error;
      process.exit(0);
    }

    throw new Error("metaplate/render rendered without its satori peer.");
  `;
  runModule(guidance, consumer);

  const nextGuidance = `
    const { createNextOg } = await import("metaplate/next");
    const plate = createNextOg({ component: () => null, alt: () => "card" });

    try {
      await plate.render({});
    } catch (error) {
      if (!error.message.includes("npm install next")) throw error;
      process.exit(0);
    }

    throw new Error("metaplate/next rendered without its next peer.");
  `;
  runModule(nextGuidance, consumer);

  const resolverSmoke = `
    require.resolve("metaplate");
    require.resolve("metaplate/render");
    require.resolve("metaplate/node");
    require.resolve("metaplate/next");
    require.resolve("metaplate/fonts");
    require.resolve("metaplate/png");
  `;
  execFileSync(
    process.execPath,
    ["--input-type=commonjs", "--eval", resolverSmoke],
    { cwd: consumer, stdio: "inherit" },
  );

  const cli = spawnSync(
    process.execPath,
    [join(consumer, "node_modules", "metaplate", "dist", "cli.js")],
    { cwd: consumer, encoding: "utf8" },
  );
  if (cli.status !== 1 || !cli.stderr.includes("Usage: metaplate verify")) {
    throw new Error("Installed CLI did not return its expected usage error.");
  }

  // Shape two: the standalone consumer, which opts in to the renderer peers
  // and has to produce real PNG bytes from the packed tarball.
  install(standalone, [
    archive,
    peerSpecifier("satori"),
    peerSpecifier("@resvg/resvg-js"),
    peerSpecifier("@fontsource/inter"),
  ]);

  const standaloneSmoke = `
    const { packageFontLoader } = await import("metaplate/fonts");
    const { createNodeOg } = await import("metaplate/node");
    const { verifyPng } = await import("metaplate/png");

    const plate = createNodeOg({
      alt: () => "card",
      fonts: packageFontLoader([
        {
          name: "Inter",
          package: "@fontsource/inter",
          file: "files/inter-latin-700-normal.woff",
          weight: 700,
        },
      ]),
      component: (copy) => ({
        type: "div",
        props: {
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            fontFamily: "Inter",
            fontSize: 64,
          },
          children: copy.title,
        },
      }),
    });

    verifyPng(await plate.render({ title: "Standalone" }), plate.size);
  `;
  runModule(standaloneSmoke, standalone);

  process.stdout.write(
    `Verified ${packed[0].filename} exports, CLI, and both consumer installs.\n`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
