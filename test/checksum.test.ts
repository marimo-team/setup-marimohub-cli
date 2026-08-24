import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseSha256, verifySha256 } from "../src/checksum.js";

describe("checksum verification", () => {
  it("parses cargo-dist checksum files", () => {
    const digest = "a".repeat(64);
    expect(parseSha256(`${digest}  mohub.tar.gz\n`)).toBe(digest);
  });

  it("rejects malformed checksum files", () => {
    expect(() => parseSha256("not a checksum")).toThrow("does not contain");
  });

  it("accepts matching files and rejects tampering", async () => {
    const directory = await mkdtemp(join(tmpdir(), "setup-marimohub-cli-"));
    const path = join(directory, "archive");
    await writeFile(path, "expected contents");
    const digest = createHash("sha256")
      .update("expected contents")
      .digest("hex");

    await expect(verifySha256(path, digest)).resolves.toBeUndefined();
    await writeFile(path, "tampered contents");
    await expect(verifySha256(path, digest)).rejects.toThrow(
      "Checksum verification failed",
    );
  });
});
