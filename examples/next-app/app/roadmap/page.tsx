import type { Metadata } from "next";
import { og, type OgCopy } from "../../lib/og";
import { openGraph } from "../../lib/metadata";

export const copy: OgCopy = {
  eyebrow: "What comes next",
  title: "Roadmap",
  description: "A dependency-ordered view of the work ahead.",
  alt: "Project roadmap",
};

const social = og.metadata("/roadmap", copy);

// `openGraph` is spread back in because a page's `openGraph` replaces the
// layout's rather than extending it.
export const metadata: Metadata = {
  title: copy.title,
  description: copy.description,
  openGraph: { ...openGraph, ...social.openGraph },
  twitter: social.twitter,
};

export default function Roadmap() {
  return <main>{copy.title}</main>;
}
