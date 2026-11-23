// src/lib/employee-status.ts
// حالات دورة حياة الموظف - employee lifecycle status values and type guard
// مصدر الحقيقة الوحيد للحالة في الخادم والعميل - single source of truth shared by server and client

export const EMPLOYEE_STATUSES = ["ACTIVE", "INACTIVE", "RENEWAL_DUE"] as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export function isEmployeeStatus(value: string): value is EmployeeStatus {
  return EMPLOYEE_STATUSES.some((status) => status === value);
}
