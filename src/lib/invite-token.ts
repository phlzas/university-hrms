// src/lib/invite-token.ts
// رموز دعوة الموظفين - invite token generation, hashing, and expiry
// الرمز يُعرض مرة واحدة ويُحفظ الـhash فقط - raw token is shown once; only its hash is persisted

import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_HOURS = 24;

const TTL_MS = INVITE_TTL_HOURS * 60 * 60 * 1000;

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createInviteToken(now: Date = new Date()): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashInviteToken(token),
    expiresAt: new Date(now.getTime() + TTL_MS),
  };
}
