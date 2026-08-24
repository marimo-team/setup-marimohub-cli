import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as toolCache from "@actions/tool-cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installRelease } from "../src/install.js";
import { platformTarget } from "../src/platform.js";
import type { ResolvedRelease } from "../src/release.js";

vi.mock("@actions/tool-cache", () => ({
  cacheDir: vi.fn(),
  downloadTool: vi.fn(),
  extractTar: vi.fn(),
  extractZip: vi.fn(),
  find: vi.fn(),
}));

const target = platformTarget("linux", "x64");
const release: ResolvedRelease = {
  version: "0.3.6",
  archive: {
    name: "mohub-x86_64-unknown-linux-gnu.tar.gz",
    browser_download_url: "https://example.test/mohub.tar.gz",
  },
  checksum: {
    name: "mohub-x86_64-unknown-linux-gnu.tar.gz.sha256",
    browser_download_url: "https://example.test/mohub.tar.gz.sha256",
  },
};

describe("installation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses and verifies a cached executable", async () => {
    const directory = await mkdtemp(join(tmpdir(), "setup-marimohub-cli-"));
    const executable = join(directory, "mohub");
    await writeFile(executable, "#!/bin/sh\necho 'mohub 0.3.6'\n");
    await chmod(executable, 0o755);
    vi.mocked(toolCache.find).mockReturnValue(directory);

    await expect(installRelease(release, target, "")).resolves.toEqual({
      path: executable,
      version: "0.3.6",
      cacheHit: true,
    });
    expect(toolCache.downloadTool).not.toHaveBeenCalled();
  });

  it("reports a missing executable in the cached archive", async () => {
    const directory = await mkdtemp(join(tmpdir(), "setup-marimohub-cli-"));
    vi.mocked(toolCache.find).mockReturnValue(directory);

    await expect(installRelease(release, target, "")).rejects.toThrow(
      "Could not find mohub in the release archive",
    );
  });

  it("rejects tampering before extracting or caching", async () => {
    const directory = await mkdtemp(join(tmpdir(), "setup-marimohub-cli-"));
    const archive = join(directory, "archive.tar.gz");
    const checksum = join(directory, "archive.tar.gz.sha256");
    await writeFile(archive, "tampered");
    await writeFile(checksum, `${"0".repeat(64)}  archive.tar.gz\n`);
    vi.mocked(toolCache.find).mockReturnValue("");
    vi.mocked(toolCache.downloadTool)
      .mockResolvedValueOnce(archive)
      .mockResolvedValueOnce(checksum);

    await expect(installRelease(release, target, "")).rejects.toThrow(
      "Checksum verification failed",
    );
    expect(toolCache.extractTar).not.toHaveBeenCalled();
    expect(toolCache.cacheDir).not.toHaveBeenCalled();
  });

  it("installs the known cargo-dist layout with authenticated downloads", async () => {
    const directory = await mkdtemp(join(tmpdir(), "setup-marimohub-cli-"));
    const archive = join(directory, "archive.tar.gz");
    const checksum = join(directory, "archive.tar.gz.sha256");
    const extracted = join(directory, "extracted");
    const toolDirectory = join(extracted, "mohub-x86_64-unknown-linux-gnu");
    const executable = join(toolDirectory, "mohub");
    await writeFile(archive, "archive contents");
    const digest = createHash("sha256")
      .update("archive contents")
      .digest("hex");
    await writeFile(checksum, `${digest}  archive.tar.gz\n`);
    await mkdir(toolDirectory, { recursive: true });
    await writeFile(executable, "#!/bin/sh\necho 'mohub 0.3.6'\n");
    await chmod(executable, 0o755);

    vi.mocked(toolCache.find).mockReturnValue("");
    vi.mocked(toolCache.downloadTool)
      .mockResolvedValueOnce(archive)
      .mockResolvedValueOnce(checksum);
    vi.mocked(toolCache.extractTar).mockResolvedValue(extracted);
    vi.mocked(toolCache.cacheDir).mockResolvedValue(toolDirectory);

    await expect(installRelease(release, target, "secret")).resolves.toEqual({
      path: executable,
      version: "0.3.6",
      cacheHit: false,
    });
    expect(toolCache.downloadTool).toHaveBeenNthCalledWith(
      1,
      release.archive.browser_download_url,
      undefined,
      "token secret",
    );
    expect(toolCache.downloadTool).toHaveBeenNthCalledWith(
      2,
      release.checksum.browser_download_url,
      undefined,
      "token secret",
    );
    expect(toolCache.cacheDir).toHaveBeenCalledWith(
      toolDirectory,
      "mohub",
      "0.3.6",
      "x86_64-unknown-linux-gnu",
    );
  });
});
