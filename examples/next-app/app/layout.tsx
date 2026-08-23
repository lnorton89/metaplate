import type { Metadata } from "next";
import type { ReactNode } from "react";
import { openGraph } from "../lib/metadata";

export const metadata: Metadata = {
  metadataBase: new URL("https://example.com"),
  openGraph,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
