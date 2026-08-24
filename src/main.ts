import * as core from "@actions/core";
import { dirname } from "node:path";

import { installRelease } from "./install.js";
import { platformTarget } from "./platform.js";
import { resolveRelease } from "./release.js";
import { normalizeRequestedVersion } from "./version.js";

async function run(): Promise<void> {
  const requestedVersion = normalizeRequestedVersion(core.getInput("version"));
  const token = core.getInput("github-token");
  if (token) {
    core.setSecret(token);
  }

  const target = platformTarget(process.platform, process.arch);
  core.info(
    `Resolving ${requestedVersion === "latest" ? "the latest mohub release" : `mohub v${requestedVersion}`} for ${target.target}.`,
  );
  const release = await resolveRelease(requestedVersion, target, token);
  const result = await installRelease(release, target, token);

  core.addPath(dirname(result.path));
  core.setOutput("mohub-version", result.version);
  core.setOutput("mohub-path", result.path);
  core.info(
    `${result.cacheHit ? "Found" : "Installed"} mohub v${result.version} at ${result.path}.`,
  );
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
