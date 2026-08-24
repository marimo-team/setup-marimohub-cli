import { describe, expect, it, vi } from "vitest";

import { platformTarget } from "../src/platform.js";
import {
  resolveRelease,
  selectReleaseAssets,
  type GitHubRelease,
} from "../src/release.js";

const target = platformTarget("linux", "x64");
const archive = "mohub-x86_64-unknown-linux-gnu.tar.gz";

function release(overrides: Partial<GitHubRelease> = {}): GitHubRelease {
  return {
    tag_name: "v0.3.5",
    draft: false,
    prerelease: false,
    assets: [
      {
        name: archive,
        browser_download_url: `https://example.test/${archive}`,
      },
      {
        name: `${archive}.sha256`,
        browser_download_url: `https://example.test/${archive}.sha256`,
      },
    ],
    ...overrides,
  };
}

describe("release resolution", () => {
  it("selects the archive and checksum", () => {
    expect(selectReleaseAssets(release(), target)).toMatchObject({
      version: "0.3.5",
      archive: { name: archive },
      checksum: { name: `${archive}.sha256` },
    });
  });

  it("reports every missing asset", () => {
    expect(() => selectReleaseAssets(release({ assets: [] }), target)).toThrow(
      `${archive}, ${archive}.sha256`,
    );
  });

  it("rejects prereleases", () => {
    expect(() =>
      selectReleaseAssets(release({ prerelease: true }), target),
    ).toThrow("not a published stable release");
  });

  it("retries release propagation and sends the token", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockResolvedValueOnce(Response.json(release()));
    const sleep = vi.fn(async () => undefined);

    await expect(
      resolveRelease("0.3.5", target, "secret", {
        fetch: fetchMock,
        sleep,
        attempts: 2,
      }),
    ).resolves.toMatchObject({ version: "0.3.5" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer secret" }),
    });
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("rejects a mismatched exact release", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(release()));
    await expect(
      resolveRelease("0.3.6", target, "", { fetch: fetchMock, attempts: 1 }),
    ).rejects.toThrow("when v0.3.6 was requested");
  });
});
