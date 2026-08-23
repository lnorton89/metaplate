import { packageFontLoader } from "metaplate/fonts";
import { createNodeOg } from "metaplate/node";

export const og = createNodeOg<{ title: string }>({
  alt: (copy) => `${copy.title} social card`,
  fonts: packageFontLoader([
    {
      name: "Inter",
      package: "@fontsource/inter",
      file: "files/inter-latin-700-normal.woff",
      weight: 700,
    },
  ]),
  component: (copy) => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        background: "#111",
        color: "#fff",
        fontFamily: "Inter",
        fontSize: 72,
        padding: 72,
      }}
    >
      {copy.title}
    </div>
  ),
});
