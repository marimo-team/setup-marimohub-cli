import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

const SHA256_PATTERN = /(?:^|\s)([a-fA-F0-9]{64})(?:\s|$)/;

export function parseSha256(contents: string): string {
  const match = SHA256_PATTERN.exec(contents);
  if (!match?.[1]) {
    throw new Error(
      "The release checksum file does not contain a SHA-256 digest.",
    );
  }
  return match[1].toLowerCase();
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

export async function verifySha256(
  path: string,
  expected: string,
): Promise<void> {
  const actual = await sha256File(path);
  if (actual !== expected.toLowerCase()) {
    throw new Error(
      `Checksum verification failed: expected ${expected}, received ${actual}.`,
    );
  }
}
