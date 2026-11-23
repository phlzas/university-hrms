// src/lib/account-access.ts
// وصول حساب الموظف - employee account access helpers
// الحذف الناعم يمنع الدخول - a soft-deleted (tombstoned) employee loses access

export function isEmployeeTombstoned(deletedAt: Date | null): boolean {
  return deletedAt !== null;
}
