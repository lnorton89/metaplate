export type OptionalPeer = {
  /** Package name as it appears in `peerDependencies`. */
  package: string;
  /** Entry points that need the peer, used in the install guidance. */
  entries: string;
};

const MISSING_MODULE_CODES = new Set(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"]);

/**
 * Reports whether the peer itself is missing. A resolution failure naming some
 * other specifier means the peer is installed but its own tree is incomplete,
 * and telling that consumer to install the peer would send them the wrong way.
 */
function isMissingPeer(error: unknown, packageName: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code !== "string" || !MISSING_MODULE_CODES.has(code)) return false;
  if (typeof message !== "string") return false;

  // Node quotes the specifier it could not resolve: `Cannot find package 'x'
  // imported from y`. Matching the quoted form distinguishes a missing peer
  // from a peer that appears unquoted as the importer of something else.
  return message.includes(`'${packageName}'`) || message.includes(`"${packageName}"`);
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
      if (!isMissingPeer(cause, peer.package)) throw cause;
      throw new Error(
        `Cannot find ${peer.package}, required by ${peer.entries}. ` +
          `Install it with: npm install ${peer.package}`,
        { cause },
      );
    });

    return pending;
  };
}
