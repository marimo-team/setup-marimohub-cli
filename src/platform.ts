export interface PlatformTarget {
  target: string;
  archiveExtension: ".tar.gz" | ".zip";
  executable: "mohub" | "mohub.exe";
}

const TARGETS: Record<string, PlatformTarget> = {
  "darwin-arm64": {
    target: "aarch64-apple-darwin",
    archiveExtension: ".tar.gz",
    executable: "mohub",
  },
  "darwin-x64": {
    target: "x86_64-apple-darwin",
    archiveExtension: ".tar.gz",
    executable: "mohub",
  },
  "linux-arm64": {
    target: "aarch64-unknown-linux-gnu",
    archiveExtension: ".tar.gz",
    executable: "mohub",
  },
  "linux-x64": {
    target: "x86_64-unknown-linux-gnu",
    archiveExtension: ".tar.gz",
    executable: "mohub",
  },
  "win32-x64": {
    target: "x86_64-pc-windows-msvc",
    archiveExtension: ".zip",
    executable: "mohub.exe",
  },
};

export function platformTarget(
  platform: NodeJS.Platform,
  architecture: string,
): PlatformTarget {
  const key = `${platform}-${architecture}`;
  const target = TARGETS[key];
  if (!target) {
    throw new Error(
      `Unsupported runner platform ${platform}/${architecture}. Supported platforms are Linux x64/arm64, macOS x64/arm64, and Windows x64.`,
    );
  }
  return target;
}

export function archiveName(target: PlatformTarget): string {
  return `mohub-${target.target}${target.archiveExtension}`;
}
