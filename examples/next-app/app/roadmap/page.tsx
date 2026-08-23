import { pageMetadata } from "../../lib/metadata";
import type { OgCopy } from "../../lib/og";

export const copy: OgCopy = {
  eyebrow: "What comes next",
  title: "Roadmap",
  description: "A dependency-ordered view of the work ahead.",
  alt: "Project roadmap",
};

export const metadata = pageMetadata("/roadmap", copy);

export default function Roadmap() {
  return <main>{copy.title}</main>;
}
