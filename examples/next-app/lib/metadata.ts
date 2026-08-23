// Open Graph fields shared by the layout and every page. Next shallow-merges
// metadata, so a page that sets `openGraph` replaces the layout's outright;
// spreading this object back in keeps the site-level framing on each page.
export const openGraph = {
  siteName: "Metaplate example",
  type: "website",
  locale: "en_US",
} as const;
