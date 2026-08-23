import type { Metadata } from "next";
import { og, type OgCopy } from "../../lib/og";

export const copy: OgCopy = {
  eyebrow: "What comes next",
  title: "Roadmap",
  description: "A dependency-ordered view of the work ahead.",
  alt: "Project roadmap",
};

export const metadata: Metadata = {
  title: copy.title,
  description: copy.description,
  ...og.metadata("/roadmap", copy),
};

export default function Roadmap() {
  return <main>{copy.title}</main>;
}
