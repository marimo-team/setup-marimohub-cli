import { describe, expect, it } from "vitest";

import { normalizeRequestedVersion, versionFromTag } from "../src/version.js";

describe("version parsing", () => {
  it.each([
    ["latest", "latest"],
    ["", "latest"],
    ["0.3.5", "0.3.5"],
    ["v0.3.5", "0.3.5"],
  ])("normalizes %j", (input, expected) => {
    expect(normalizeRequestedVersion(input)).toBe(expected);
  });

  it.each(["main", "0.3", "0.3.5-beta.1", "../0.3.5", "vlatest"])(
    "rejects %j",
    (input) => {
      expect(() => normalizeRequestedVersion(input)).toThrow(
        "Invalid mohub version",
      );
    },
  );

  it("reads a stable GitHub release tag", () => {
    expect(versionFromTag("v1.2.3")).toBe("1.2.3");
  });
});
