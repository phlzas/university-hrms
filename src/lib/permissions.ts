// src/lib/permissions.ts
// أدوار المستخدمين والصلاحيات - shared string-role permission helper
// مصدر الحقيقة الوحيد للصلاحيات في الخادم والعميل - single source of truth for server and client gating
// ملاحظة: الدور نص عادي في Prisma، لا يوجد enum ولا حاجة لهجرة - role is a plain Prisma String, no migration needed

export const ROLES = { HR_SUPER_ADMIN: "HR_SUPER_ADMIN", HR: "HR", ADMIN: "ADMIN", VIEWER: "VIEWER", EMPLOYEE: "EMPLOYEE" } as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
export type Capability =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "import"
  | "managePermissions"
  | "readAllFiles"
  | "createEmployee"
  | "updateEmployee"
  | "deleteEmployee"
  | "restoreEmployee"
  | "provisionAccount"
  | "manageSystem";
type LegacyCapability = "create" | "read" | "update" | "delete" | "import" | "managePermissions" | "readAllFiles";
type LifecycleCapability = Exclude<Capability, LegacyCapability>;
export type SessionRole = string | null | undefined;

const ROLE_VALUES: readonly Role[] = Object.values(ROLES);

// normalizeRole() => تحويل دور الجلسة إلى دور معروف - normalize a session role string to a known Role
// يقبل المسافات الزائدة ويرفض أي قيمة غير معروفة - trims whitespace, never coerces unknown strings
export function normalizeRole(value: SessionRole): Role | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return ROLE_VALUES.find((role) => role === trimmed) ?? null;
}

// الصلاحيات السبع الأصلية محفوظة كما هي - the seven original capabilities, kept byte-for-byte
const LEGACY_FULL = {
  create: true,
  read: true,
  update: true,
  delete: true,
  import: true,
  managePermissions: true,
  readAllFiles: true,
} as const satisfies Record<LegacyCapability, boolean>;

const LEGACY_CREATE_READ = {
  create: true,
  read: true,
  update: false,
  delete: false,
  import: false,
  managePermissions: false,
  readAllFiles: true,
} as const satisfies Record<LegacyCapability, boolean>;

const LEGACY_READ_ONLY = {
  create: false,
  read: true,
  update: false,
  delete: false,
  import: false,
  managePermissions: false,
  readAllFiles: false,
} as const satisfies Record<LegacyCapability, boolean>;

const LEGACY_NONE = {
  create: false,
  read: false,
  update: false,
  delete: false,
  import: false,
  managePermissions: false,
  readAllFiles: false,
} as const satisfies Record<LegacyCapability, boolean>;

// صلاحيات دورة حياة الموظف - employee-lifecycle capabilities
const LIFECYCLE_FULL = {
  createEmployee: true,
  updateEmployee: true,
  deleteEmployee: true,
  restoreEmployee: true,
  provisionAccount: true,
  manageSystem: true,
} as const satisfies Record<LifecycleCapability, boolean>;

const LIFECYCLE_NONE = {
  createEmployee: false,
  updateEmployee: false,
  deleteEmployee: false,
  restoreEmployee: false,
  provisionAccount: false,
  manageSystem: false,
} as const satisfies Record<LifecycleCapability, boolean>;

const FULL_ACCESS: Record<Capability, boolean> = { ...LEGACY_FULL, ...LIFECYCLE_FULL };
const CREATE_READ: Record<Capability, boolean> = { ...LEGACY_CREATE_READ, ...LIFECYCLE_NONE };
const READ_ONLY: Record<Capability, boolean> = { ...LEGACY_READ_ONLY, ...LIFECYCLE_NONE };
const NO_ACCESS: Record<Capability, boolean> = { ...LEGACY_NONE, ...LIFECYCLE_NONE };

// ROLE_PERMISSIONS => مصفوفة الصلاحيات المعتمدة - approved role/capability matrix
export const ROLE_PERMISSIONS: Record<Role, Record<Capability, boolean>> = {
  [ROLES.HR_SUPER_ADMIN]: FULL_ACCESS,
  [ROLES.HR]: { ...FULL_ACCESS, ...LIFECYCLE_NONE, createEmployee: true },
  [ROLES.ADMIN]: { ...CREATE_READ, provisionAccount: true },
  [ROLES.VIEWER]: READ_ONLY,
  [ROLES.EMPLOYEE]: NO_ACCESS,
};

// hasCapability() => فحص صلاحية واحدة بدون تأثير جانبي - pure, client-safe capability check
// أي دور أو صلاحية غير معروفة تعطي false - unknown role or capability always denies
export function hasCapability(role: SessionRole, capability: Capability): boolean {
  const normalized = normalizeRole(role);
  if (normalized === null) return false;
  return ROLE_PERMISSIONS[normalized][capability] === true;
}

// مساعدات مختصرة لكل صلاحية - short helpers for each capability
export const canCreate = (role: SessionRole) => hasCapability(role, "create");
export const canRead = (role: SessionRole) => hasCapability(role, "read");
export const canUpdate = (role: SessionRole) => hasCapability(role, "update");
export const canDelete = (role: SessionRole) => hasCapability(role, "delete");
export const canImport = (role: SessionRole) => hasCapability(role, "import");
export const canManagePermissions = (role: SessionRole) => hasCapability(role, "managePermissions");
export const canReadAllFiles = (role: SessionRole) => hasCapability(role, "readAllFiles");
export const canCreateEmployee = (role: SessionRole) => hasCapability(role, "createEmployee");
export const canUpdateEmployee = (role: SessionRole) => hasCapability(role, "updateEmployee");
export const canDeleteEmployee = (role: SessionRole) => hasCapability(role, "deleteEmployee");
export const canRestoreEmployee = (role: SessionRole) => hasCapability(role, "restoreEmployee");
export const canProvisionAccount = (role: SessionRole) => hasCapability(role, "provisionAccount");
export const canManageSystem = (role: SessionRole) => hasCapability(role, "manageSystem");
