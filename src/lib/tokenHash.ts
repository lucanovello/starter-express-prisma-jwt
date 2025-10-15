import { createHash } from "node:crypto";

export function hashRefresh(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
