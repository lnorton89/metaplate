import { describe, expect, it } from "vitest";
import { parseVerifyTargets, VERIFY_USAGE } from "../src/cli-args.js";

describe("parseVerifyTargets", () => {
  it("applies one size to multiple files", () => {
    expect(
      parseVerifyTargets(["verify", "--size", "1200x630", "one.png", "two.png"]),
    ).toEqual([
      { file: "one.png", size: { width: 1200, height: 630 } },
      { file: "two.png", size: { width: 1200, height: 630 } },
    ]);
  });

  it("supports repeated size groups", () => {
    expect(
      parseVerifyTargets([
        "verify",
        "--size",
        "512x512",
        "mark.png",
        "--size",
        "1280x640",
        "banner.png",
      ]),
    ).toEqual([
      { file: "mark.png", size: { width: 512, height: 512 } },
      { file: "banner.png", size: { width: 1280, height: 640 } },
    ]);
  });

  it.each([
    { args: [] },
    { args: ["verify"] },
    { args: ["verify", "orphan.png"] },
    { args: ["verify", "--size", "wide", "image.png"] },
  ] satisfies { args: string[] }[])("rejects invalid arguments: $args", ({ args }) => {
    expect(() => parseVerifyTargets(args)).toThrow(VERIFY_USAGE);
  });
});
