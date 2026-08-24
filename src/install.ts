import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
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

async function findExecutableIn(
  root: string,
  name: string,
): Promise<string | undefined> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      const found = await findExecutableIn(path, name);
      if (found) {
        return found;
      }
    } else if (entry.isFile() && entry.name === name) {
      return path;
    }
  }
  return undefined;
}

async function findExecutable(root: string, name: string): Promise<string> {
  const path = await findExecutableIn(root, name);
  if (path) {
    return path;
  }
  throw new Error(`Could not find ${name} in the extracted release archive.`);
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
): Promise<InstallResult> {
  let cachedPath = toolCache.find("mohub", release.version, target.target);
  const cacheHit = cachedPath !== "";

  if (!cacheHit) {
    const [archivePath, checksumPath] = await Promise.all([
      toolCache.downloadTool(release.archive.browser_download_url),
      toolCache.downloadTool(release.checksum.browser_download_url),
    ]);
    const expectedChecksum = parseSha256(await readFile(checksumPath, "utf8"));
    await verifySha256(archivePath, expectedChecksum);

    const extractedPath =
      target.archiveExtension === ".zip"
        ? await toolCache.extractZip(archivePath)
        : await toolCache.extractTar(archivePath);
    cachedPath = await toolCache.cacheDir(
      extractedPath,
      "mohub",
      release.version,
      target.target,
    );
  }

  const path = await findExecutable(cachedPath, target.executable);
  await verifyInstalledVersion(path, release.version);
  return { path, version: release.version, cacheHit };
}

export function executableDirectory(result: InstallResult): string {
  return dirname(result.path);
}
