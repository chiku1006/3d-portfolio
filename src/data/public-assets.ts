import { existsSync } from "node:fs";
import path from "node:path";

export function hasPublicAsset(src: string) {
  return existsSync(path.join(process.cwd(), "public", src));
}
