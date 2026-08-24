import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import * as toolCache from "@actions/tool-cache";

import { parseSha256, verifySha256 } from "./checksum.js";
import type { PlatformTarget } from "./platform.js";
import type { ResolvedRelease } from "./release.js";

const execFileAsync = promisify(execFile);

export interface InstallResult {
  path: string;
  version: string;
  cacheHit: boolean;
}

async function verifyInstalledVersion(
  path: string,
  expected: string,
): Promise<void> {
  const { stdout } = await execFileAsync(path, ["--version"]);
  const match = /^mohub\s+(\d+\.\d+\.\d+)\s*$/.exec(stdout);
  if (!match?.[1]) {
    throw new Error(
      `Unexpected output from mohub --version: ${JSON.stringify(stdout.trim())}.`,
    );
  }
  if (match[1] !== expected) {
    throw new Error(
      `Installed mohub version ${match[1]} does not match requested version ${expected}.`,
    );
  }
}

export async function installRelease(
  release: ResolvedRelease,
  target: PlatformTarget,
  token: string,
): Promise<InstallResult> {
  let cachedPath = toolCache.find("mohub", release.version, target.target);
  const cacheHit = cachedPath !== "";

  if (!cacheHit) {
    const auth = token ? `token ${token}` : undefined;
    const [archivePath, checksumPath] = await Promise.all([
      toolCache.downloadTool(
        release.archive.browser_download_url,
        undefined,
        auth,
      ),
      toolCache.downloadTool(
        release.checksum.browser_download_url,
        undefined,
        auth,
      ),
    ]);
    const expectedChecksum = parseSha256(await readFile(checksumPath, "utf8"));
    await verifySha256(archivePath, expectedChecksum);

    const extractedPath =
      target.archiveExtension === ".zip"
        ? await toolCache.extractZip(archivePath)
        : await toolCache.extractTar(archivePath);
    const toolPath =
      target.archiveExtension === ".zip"
        ? extractedPath
        : join(extractedPath, `mohub-${target.target}`);
    cachedPath = await toolCache.cacheDir(
      toolPath,
      "mohub",
      release.version,
      target.target,
    );
  }

  const path = join(cachedPath, target.executable);
  try {
    await access(path);
  } catch {
    throw new Error(
      `Could not find ${target.executable} in the release archive.`,
    );
  }
  await verifyInstalledVersion(path, release.version);
  return { path, version: release.version, cacheHit };
}
