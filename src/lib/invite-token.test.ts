// src/lib/invite-token.test.ts
// اختبارات وحدة لرموز الدعوة - unit tests for invite token creation and hashing
// تغطي الطول والـhash وانتهاء الصلاحية - covers token shape, hash, and expiry

import { createHash } from "node:crypto";
import { INVITE_TTL_HOURS, createInviteToken, hashInviteToken } from "@/lib/invite-token";

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("INVITE_TTL_HOURS", () => {
  it("is 24", () => {
    expect(INVITE_TTL_HOURS).toBe(24);
  });
});

describe("hashInviteToken", () => {
  it("returns a 64-character lowercase hex digest", () => {
    expect(hashInviteToken("token")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches Node SHA-256 of the input", () => {
    const token = "sample-token";
    expect(hashInviteToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashInviteToken("a")).not.toBe(hashInviteToken("b"));
  });
});

describe("createInviteToken", () => {
  it("expires 24 hours after the supplied time", () => {
    const now = new Date("2026-05-01T12:00:00.000Z");
    expect(createInviteToken(now).expiresAt.toISOString()).toBe("2026-05-02T12:00:00.000Z");
  });

  it("does not mutate the supplied time", () => {
    const now = new Date("2026-05-01T12:00:00.000Z");
    createInviteToken(now);
    expect(now.toISOString()).toBe("2026-05-01T12:00:00.000Z");
  });

  it("uses the system clock when no time is supplied", () => {
    expect(createInviteToken().expiresAt.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });

  it("generates a base64url token of 32 random bytes", () => {
    expect(createInviteToken().token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("returns a hash that matches the returned token", () => {
    const { token, tokenHash } = createInviteToken();
    expect(tokenHash).toBe(hashInviteToken(token));
  });

  it("generates a different token on each call", () => {
    expect(createInviteToken().token).not.toBe(createInviteToken().token);
  });
});
