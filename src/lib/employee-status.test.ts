// src/lib/employee-status.test.ts
// اختبارات وحدة لحالات الموظف - unit tests for employee status values and guard
// تمنع المطابقة المرنة أو تحويل القيم - guards against loose or coercive status matching

import { EMPLOYEE_STATUSES, isEmployeeStatus } from "@/lib/employee-status";

describe("EMPLOYEE_STATUSES", () => {
  it("exposes the three approved statuses in order", () => {
    expect(EMPLOYEE_STATUSES).toEqual(["ACTIVE", "INACTIVE", "RENEWAL_DUE"]);
  });
});

describe("isEmployeeStatus", () => {
  it.each(["ACTIVE", "INACTIVE", "RENEWAL_DUE"])("accepts the exact status %s", (status) => {
    expect(isEmployeeStatus(status)).toBe(true);
  });

  it.each(["active", "Active", "RENEWAL_DUE ", " RENEWAL_DUE", "RENEWAL", "", "UNKNOWN"])(
    "rejects the non-exact value %p",
    (value) => {
      expect(isEmployeeStatus(value)).toBe(false);
    }
  );
});
