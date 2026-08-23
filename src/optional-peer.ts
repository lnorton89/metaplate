export type OptionalPeer = {
  /** Package name as it appears in `peerDependencies`. */
  package: string;
  /** Entry points that need the peer, used in the install guidance. */
  entries: string;
};

const MISSING_MODULE_CODES = new Set(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"]);

function isMissingModule(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const { code } = error as { code?: unknown };
  return typeof code === "string" && MISSING_MODULE_CODES.has(code);
}

/**
 * Defers an optional peer import to first use so metadata-only and Next.js
 * installs never resolve the standalone renderer or its native binaries.
 * A missing peer becomes an install recipe; every other failure is untouched.
 */
export function optionalPeer<T>(
  peer: OptionalPeer,
  load: () => Promise<T>,
): () => Promise<T> {
  let pending: Promise<T> | undefined;

  return () => {
    // A rejected attempt is discarded so a later call can succeed once the
    // peer is installed, which keeps long-lived dev servers usable.
    pending ??= load().catch((cause: unknown) => {
      pending = undefined;
      if (!isMissingModule(cause)) throw cause;
      throw new Error(
        `Cannot find ${peer.package}, required by ${peer.entries}. ` +
          `Install it with: npm install ${peer.package}`,
        { cause },
      );
    });

    return pending;
  };
}
