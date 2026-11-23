// src/app/api/employees/[id]/restore/route.ts
// استعادة موظف محذوف ناعماً - restore a soft-deleted employee
// الاستعادة لا تفتح الحساب المرتبط؛ حالة المستخدم تُدار في مكان آخر
// Restore does not unblock the linked account; user state is managed elsewhere

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { canRestoreEmployee } from "@/lib/permissions";

// POST /api/employees/:id/restore
// إعادة الموظف إلى القائمة النشطة - bring the employee back into the active list
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canRestoreEmployee(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    // Next.js 16: معاملات المسار Promise ويجب انتظارها - Next.js 16 route params are a Promise and must be awaited
    const { id } = await ctx.params;

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) return fail("EMPLOYEE_NOT_FOUND", "الموظف غير موجود - employee not found", 404);
    if (existing.deletedAt === null) {
      return fail("EMPLOYEE_NOT_DELETED", "الموظف غير محذوف - employee is not deleted", 409);
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: { deletedAt: null, restoredAt: new Date(), updatedBy: s.sub },
    });
    return ok({ employee });
  } catch (e) {
    console.error("EMPLOYEE_RESTORE_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
