import { describe, expect, it, vi } from "vitest";
import { optionalPeer } from "../src/optional-peer.js";

const peer = { package: "satori", entries: "metaplate/render and metaplate/node" };

function missingModule(specifier: string) {
  return Object.assign(new Error(`Cannot find package '${specifier}'`), {
    code: "ERR_MODULE_NOT_FOUND",
  });
}

describe("optionalPeer", () => {
  it("loads the peer once and reuses it", async () => {
    const load = vi.fn(() => Promise.resolve("satori"));
    const loadPeer = optionalPeer(peer, load);

    await expect(loadPeer()).resolves.toBe("satori");
    await expect(loadPeer()).resolves.toBe("satori");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("turns a missing peer into install guidance", async () => {
    const cause = missingModule("satori");
    const loadPeer = optionalPeer(peer, () => Promise.reject(cause));

    await expect(loadPeer()).rejects.toThrow(
      "Cannot find satori, required by metaplate/render and metaplate/node. Install it with: npm install satori",
    );
    await expect(loadPeer()).rejects.toMatchObject({ cause });
  });

  it("retries after the peer is installed", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(missingModule("satori"))
      .mockResolvedValue("satori");
    const loadPeer = optionalPeer(peer, load);

    await expect(loadPeer()).rejects.toThrow("npm install satori");
    await expect(loadPeer()).resolves.toBe("satori");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("leaves unrelated failures alone", async () => {
    // Resvg reports a missing native binding rather than a missing package.
    const cause = new Error("Failed to load native binding");
    const loadPeer = optionalPeer(peer, () => Promise.reject(cause));

    await expect(loadPeer()).rejects.toBe(cause);
  });
});
