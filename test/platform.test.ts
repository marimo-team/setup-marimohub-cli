import { describe, expect, it } from "vitest";

import { archiveName, platformTarget } from "../src/platform.js";

describe("platform targets", () => {
  it.each([
    ["linux", "x64", "x86_64-unknown-linux-gnu", ".tar.gz", "mohub"],
    ["linux", "arm64", "aarch64-unknown-linux-gnu", ".tar.gz", "mohub"],
    ["darwin", "x64", "x86_64-apple-darwin", ".tar.gz", "mohub"],
    ["darwin", "arm64", "aarch64-apple-darwin", ".tar.gz", "mohub"],
    ["win32", "x64", "x86_64-pc-windows-msvc", ".zip", "mohub.exe"],
  ] as const)(
    "maps %s/%s",
    (platform, architecture, triple, extension, executable) => {
      const target = platformTarget(platform, architecture);
      expect(target).toEqual({
        target: triple,
        archiveExtension: extension,
        executable,
      });
      expect(archiveName(target)).toBe(`mohub-${triple}${extension}`);
    },
  );

  it("rejects unsupported runners", () => {
    expect(() => platformTarget("win32", "arm64")).toThrow(
      "Unsupported runner platform",
    );
  });
});
