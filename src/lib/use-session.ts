"use client";
// جلسة العميل - client session gate derived from the shared permission matrix
// لا صلاحية تعديل قبل معرفة الدور - no mutation capability until the role is known

import { useEffect, useState } from "react";
import {
  canCreate as roleCanCreate,
  canCreateEmployee as roleCanCreateEmployee,
  canDelete as roleCanDelete,
  canDeleteEmployee as roleCanDeleteEmployee,
  canImport as roleCanImport,
  canManagePermissions as roleCanManagePermissions,
  canManageSystem as roleCanManageSystem,
  canProvisionAccount as roleCanProvisionAccount,
  canRead as roleCanRead,
  canReadAllFiles as roleCanReadAllFiles,
  canRestoreEmployee as roleCanRestoreEmployee,
  canUpdate as roleCanUpdate,
  canUpdateEmployee as roleCanUpdateEmployee,
  normalizeRole,
  type Role,
  type SessionRole,
} from "@/lib/permissions";

export type SessionGate = {
  role: Role | null;
  ready: boolean;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canImport: boolean;
  canManagePermissions: boolean;
  canReadAllFiles: boolean;
  canCreateEmployee: boolean;
  canUpdateEmployee: boolean;
  canDeleteEmployee: boolean;
  canRestoreEmployee: boolean;
  canProvisionAccount: boolean;
  canManageSystem: boolean;
};

// قراءة آمنة لدور الجلسة من رد /api/auth/me - safe role read from the auth response
function readSessionRole(data: unknown): SessionRole {
  if (typeof data !== "object" || data === null || !("user" in data)) return null;
  const user: unknown = data.user;
  if (typeof user !== "object" || user === null || !("role" in user)) return null;
  const value: unknown = user.role;
  return typeof value === "string" ? value : null;
}

export function useSession(): SessionGate {
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void (async () => {
      const response = await fetch("/api/auth/me", { cache: "no-store", signal: controller.signal }).catch(() => null);
      if (active && response?.ok) {
        const data: unknown = await response.json().catch(() => null);
        if (active) setRole(normalizeRole(readSessionRole(data)));
      }
      if (active) setReady(true);
    })();
    return () => { active = false; controller.abort(); };
  }, []);

  return {
    role,
    ready,
    canCreate: ready && roleCanCreate(role),
    canRead: ready && roleCanRead(role),
    canUpdate: ready && roleCanUpdate(role),
    canDelete: ready && roleCanDelete(role),
    canImport: ready && roleCanImport(role),
    canManagePermissions: ready && roleCanManagePermissions(role),
    canReadAllFiles: ready && roleCanReadAllFiles(role),
    canCreateEmployee: ready && roleCanCreateEmployee(role),
    canUpdateEmployee: ready && roleCanUpdateEmployee(role),
    canDeleteEmployee: ready && roleCanDeleteEmployee(role),
    canRestoreEmployee: ready && roleCanRestoreEmployee(role),
    canProvisionAccount: ready && roleCanProvisionAccount(role),
    canManageSystem: ready && roleCanManageSystem(role),
  };
}
