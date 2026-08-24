import { archiveName, type PlatformTarget } from "./platform.js";
import { versionFromTag } from "./version.js";

const API_ROOT = "https://api.github.com/repos/marimo-team/marimohub/releases";
const LOOKUP_TIMEOUT_MS = 10_000;

class RetryableReleaseError extends Error {}

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

export interface ResolvedRelease {
  version: string;
  archive: ReleaseAsset;
  checksum: ReleaseAsset;
}

export interface ResolveOptions {
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  attempts?: number;
}

function endpoint(version: "latest" | string): string {
  return version === "latest"
    ? `${API_ROOT}/latest`
    : `${API_ROOT}/tags/v${version}`;
}

async function fetchRelease(
  version: "latest" | string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<GitHubRelease> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "setup-marimohub-cli",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchImpl(endpoint(version), {
    headers,
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!response.ok) {
    const ErrorType =
      response.status === 404 ||
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500
        ? RetryableReleaseError
        : Error;
    throw new ErrorType(
      `GitHub release lookup failed with HTTP ${response.status} for ${version === "latest" ? "the latest release" : `v${version}`}.`,
    );
  }
  return (await response.json()) as GitHubRelease;
}

export function selectReleaseAssets(
  release: GitHubRelease,
  target: PlatformTarget,
): ResolvedRelease {
  if (release.draft || release.prerelease) {
    throw new Error(
      `Release ${release.tag_name} is not a published stable release.`,
    );
  }

  const name = archiveName(target);
  const archive = release.assets.find((asset) => asset.name === name);
  const checksum = release.assets.find(
    (asset) => asset.name === `${name}.sha256`,
  );
  if (!archive || !checksum) {
    const missing = [
      archive ? undefined : name,
      checksum ? undefined : `${name}.sha256`,
    ].filter((value): value is string => value !== undefined);
    throw new RetryableReleaseError(
      `Release ${release.tag_name} is missing required asset(s): ${missing.join(", ")}.`,
    );
  }

  return {
    version: versionFromTag(release.tag_name),
    archive,
    checksum,
  };
}

export async function resolveRelease(
  requestedVersion: "latest" | string,
  target: PlatformTarget,
  token: string,
  options: ResolveOptions = {},
): Promise<ResolvedRelease> {
  const fetchImpl = options.fetch ?? fetch;
  const sleep =
    options.sleep ??
    ((milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const attempts = options.attempts ?? 4;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const release = await fetchRelease(requestedVersion, token, fetchImpl);
      const resolved = selectReleaseAssets(release, target);
      if (
        requestedVersion !== "latest" &&
        resolved.version !== requestedVersion
      ) {
        throw new Error(
          `GitHub returned release v${resolved.version} when v${requestedVersion} was requested.`,
        );
      }
      return resolved;
    } catch (error) {
      lastError = error;
      const isNetworkError =
        error instanceof TypeError ||
        (error instanceof Error &&
          (error.name === "AbortError" || error.name === "TimeoutError"));
      if (
        attempt === attempts ||
        (!(error instanceof RetryableReleaseError) && !isNetworkError)
      ) {
        throw error;
      }
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}
