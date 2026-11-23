// src/lib/account-access.test.ts
// اختبارات وحدة لحالة حساب الموظف - unit tests for the employee tombstone check
// الحذف الناعم يمنع الوصول - soft deletion blocks account access

import { isEmployeeTombstoned } from "@/lib/account-access";

describe("isEmployeeTombstoned", () => {
  it("returns false when deletedAt is null", () => {
    expect(isEmployeeTombstoned(null)).toBe(false);
  });

  it("returns true when deletedAt is a date", () => {
    expect(isEmployeeTombstoned(new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("returns true for a date at the Unix epoch boundary", () => {
    expect(isEmployeeTombstoned(new Date(0))).toBe(true);
  });
});
