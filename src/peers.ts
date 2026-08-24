import { optionalPeer } from "./optional-peer.js";

/** Not an entry point: these loaders are bundled into the entries that use them. */
export const loadSatori = optionalPeer(
  { package: "satori", entries: "metaplate/render and metaplate/node" },
  async (): Promise<typeof import("satori").default> =>
    (await import("satori")).default,
);

export const loadResvg = optionalPeer(
  { package: "@resvg/resvg-js", entries: "metaplate/node" },
  async (): Promise<typeof import("@resvg/resvg-js").Resvg> =>
    (await import("@resvg/resvg-js")).Resvg,
);
