// src/lib/permissions.test.ts
// اختبارات وحدة لمصفوفة الأدوار والصلاحيات - unit tests for the role/capability matrix
// تمنع انحدار الصلاحيات: ADMIN/VIEWER لا يكتسبان صلاحيات وHR لا يفقد - guards against privilege regressions

import {
  ROLES,
  ROLE_PERMISSIONS,
  canCreate,
  canRead,
  canUpdate,
  canDelete,
  canImport,
  canManagePermissions,
  canReadAllFiles,
  canCreateEmployee,
  canUpdateEmployee,
  canDeleteEmployee,
  canRestoreEmployee,
  canProvisionAccount,
  canManageSystem,
  hasCapability,
  normalizeRole,
} from "@/lib/permissions";
import type { Capability, Role, SessionRole } from "@/lib/permissions";

const CAPABILITIES = [
  "create",
  "read",
  "update",
  "delete",
  "import",
  "managePermissions",
  "readAllFiles",
  "createEmployee",
  "updateEmployee",
  "deleteEmployee",
  "restoreEmployee",
  "provisionAccount",
  "manageSystem",
] as const satisfies readonly Capability[];

// المصفوفة المتوقعة معتمدة من المستخدم، ومكتوبة بشكل مستقل عن التنفيذ - approved matrix, independent of implementation
const EXPECTED: Record<Role, Record<Capability, boolean>> = {
  HR_SUPER_ADMIN: { create: true, read: true, update: true, delete: true, import: true, managePermissions: true, readAllFiles: true, createEmployee: true, updateEmployee: true, deleteEmployee: true, restoreEmployee: true, provisionAccount: true, manageSystem: true },
  HR: { create: true, read: true, update: true, delete: true, import: true, managePermissions: true, readAllFiles: true, createEmployee: true, updateEmployee: false, deleteEmployee: false, restoreEmployee: false, provisionAccount: false, manageSystem: false },
  ADMIN: { create: true, read: true, update: false, delete: false, import: false, managePermissions: false, readAllFiles: true, createEmployee: false, updateEmployee: false, deleteEmployee: false, restoreEmployee: false, provisionAccount: true, manageSystem: false },
  VIEWER: { create: false, read: true, update: false, delete: false, import: false, managePermissions: false, readAllFiles: false, createEmployee: false, updateEmployee: false, deleteEmployee: false, restoreEmployee: false, provisionAccount: false, manageSystem: false },
  EMPLOYEE: { create: false, read: false, update: false, delete: false, import: false, managePermissions: false, readAllFiles: false, createEmployee: false, updateEmployee: false, deleteEmployee: false, restoreEmployee: false, provisionAccount: false, manageSystem: false },
};

const ADMIN_DENIED = [
  "update", "delete", "import", "managePermissions",
  "createEmployee", "updateEmployee", "deleteEmployee", "restoreEmployee", "manageSystem",
] as const satisfies readonly Capability[];
const VIEWER_DENIED = [
  "create", "update", "delete", "import", "managePermissions",
  "createEmployee", "updateEmployee", "deleteEmployee", "restoreEmployee", "provisionAccount", "manageSystem",
] as const satisfies readonly Capability[];
const UNKNOWN_ROLES = [null, undefined, "", "UNKNOWN", "admin", "employee"] as const satisfies readonly SessionRole[];

describe("normalizeRole", () => {
  it.each([
    ["HR_SUPER_ADMIN", ROLES.HR_SUPER_ADMIN],
    ["HR", ROLES.HR],
    ["ADMIN", ROLES.ADMIN],
    ["VIEWER", ROLES.VIEWER],
    ["EMPLOYEE", ROLES.EMPLOYEE],
  ])("accepts the exact role %s", (input, expected) => {
    expect(normalizeRole(input)).toBe(expected);
  });

  it.each([
    ["  HR_SUPER_ADMIN  ", ROLES.HR_SUPER_ADMIN],
    ["\tHR\n", ROLES.HR],
    [" ADMIN ", ROLES.ADMIN],
    [" VIEWER ", ROLES.VIEWER],
    [" EMPLOYEE ", ROLES.EMPLOYEE],
  ])("trims whitespace around %p", (input, expected) => {
    expect(normalizeRole(input)).toBe(expected);
  });

  it.each(["", "   ", "SUPER_ADMIN", "admin", "hr", "employee", "UNKNOWN", null, undefined] satisfies readonly SessionRole[])(
    "returns null for unknown or empty role %p",
    (input) => {
      expect(normalizeRole(input)).toBeNull();
    }
  );
});

describe("hasCapability", () => {
  it.each(Object.values(ROLES))("matches the approved matrix for %s", (role) => {
    for (const capability of CAPABILITIES) {
      expect(hasCapability(role, capability)).toBe(EXPECTED[role][capability]);
    }
  });

  it("exports the same approved matrix", () => {
    expect(ROLE_PERMISSIONS).toEqual(EXPECTED);
  });

  it.each(ADMIN_DENIED)("denies ADMIN the mutation capability %s", (capability) => {
    expect(hasCapability(ROLES.ADMIN, capability)).toBe(false);
  });

  it.each(VIEWER_DENIED)("denies VIEWER the capability %s", (capability) => {
    expect(hasCapability(ROLES.VIEWER, capability)).toBe(false);
  });

  it.each(UNKNOWN_ROLES)("denies every capability for unknown role %p", (role) => {
    for (const capability of CAPABILITIES) {
      expect(hasCapability(role, capability)).toBe(false);
    }
  });

  it("denies a capability that is absent at runtime", () => {
    const result: unknown = Reflect.apply(hasCapability, undefined, [ROLES.HR_SUPER_ADMIN, "bogus"]);
    expect(result).toBe(false);
  });
});

describe("capability helpers", () => {
  const helpers: ReadonlyArray<{ name: string; capability: Capability; run: (role: SessionRole) => boolean }> = [
    { name: "canCreate", capability: "create", run: canCreate },
    { name: "canRead", capability: "read", run: canRead },
    { name: "canUpdate", capability: "update", run: canUpdate },
    { name: "canDelete", capability: "delete", run: canDelete },
    { name: "canImport", capability: "import", run: canImport },
    { name: "canManagePermissions", capability: "managePermissions", run: canManagePermissions },
    { name: "canReadAllFiles", capability: "readAllFiles", run: canReadAllFiles },
    { name: "canCreateEmployee", capability: "createEmployee", run: canCreateEmployee },
    { name: "canUpdateEmployee", capability: "updateEmployee", run: canUpdateEmployee },
    { name: "canDeleteEmployee", capability: "deleteEmployee", run: canDeleteEmployee },
    { name: "canRestoreEmployee", capability: "restoreEmployee", run: canRestoreEmployee },
    { name: "canProvisionAccount", capability: "provisionAccount", run: canProvisionAccount },
    { name: "canManageSystem", capability: "manageSystem", run: canManageSystem },
  ];

  it.each(helpers)("$name matches the matrix for every role", ({ capability, run }) => {
    for (const role of Object.values(ROLES)) {
      expect(run(role)).toBe(EXPECTED[role][capability]);
    }
  });

  it.each(helpers)("$name denies unknown roles", ({ run }) => {
    expect(run("UNKNOWN")).toBe(false);
    expect(run(null)).toBe(false);
    expect(run(undefined)).toBe(false);
  });
});

// انحدار صلاحيات دورة حياة الموظف - employee-lifecycle privilege regression guards
describe("employee-lifecycle regressions", () => {
  it("keeps HR update=true while updateEmployee=false", () => {
    // Given: دور HR - the HR role
    const role = ROLES.HR;
    // When: فحص القديم والجديد - checking the legacy and the new capability
    const legacy = hasCapability(role, "update");
    const lifecycle = hasCapability(role, "updateEmployee");
    // Then: HR يعدل السجلات ولا يعدل الموظفين - records may be updated, employees may not
    expect(legacy).toBe(true);
    expect(lifecycle).toBe(false);
  });

  it("grants HR_SUPER_ADMIN restoreEmployee", () => {
    // Given: دور HR_SUPER_ADMIN - the super admin role
    const role = ROLES.HR_SUPER_ADMIN;
    // When: فحص استعادة الموظف - checking employee restoration
    const result = hasCapability(role, "restoreEmployee");
    // Then: الاستعادة مسموحة - restoration is granted
    expect(result).toBe(true);
  });

  it("grants ADMIN provisionAccount but not createEmployee or managePermissions", () => {
    // Given: دور ADMIN - the admin role
    const role = ROLES.ADMIN;
    // When: فحص الصلاحيات الثلاث - checking the three capabilities
    const provision = hasCapability(role, "provisionAccount");
    const createEmployee = hasCapability(role, "createEmployee");
    const managePermissions = hasCapability(role, "managePermissions");
    // Then: إنشاء الحساب مسموح والباقي ممنوع - provisioning is granted, the others are denied
    expect(provision).toBe(true);
    expect(createEmployee).toBe(false);
    expect(managePermissions).toBe(false);
  });

  it("denies EMPLOYEE every capability", () => {
    // Given: دور EMPLOYEE - the employee role
    const role = ROLES.EMPLOYEE;
    // When: فحص كل الصلاحيات - checking every capability
    const results = CAPABILITIES.map((capability) => hasCapability(role, capability));
    // Then: كل الصلاحيات ممنوعة - all capabilities are denied
    expect(results).toEqual(CAPABILITIES.map(() => false));
  });
});
