const VERSION_PATTERN = /^v?(\d+\.\d+\.\d+)$/;

export function normalizeRequestedVersion(value: string): "latest" | string {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "latest") {
    return "latest";
  }

  const match = VERSION_PATTERN.exec(trimmed);
  if (!match?.[1]) {
    throw new Error(
      `Invalid mohub version ${JSON.stringify(value)}. Use "latest" or an exact X.Y.Z version.`,
    );
  }
  return match[1];
}

export function versionFromTag(tag: string): string {
  const match = VERSION_PATTERN.exec(tag);
  if (!match?.[1]) {
    throw new Error(
      `Release tag ${JSON.stringify(tag)} is not a stable mohub version.`,
    );
  }
  return match[1];
}
