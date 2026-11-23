// src/app/api/employees/[id]/route.ts
// تفاصيل الموظف: تعديل وحذف ناعم - employee detail: update and soft delete
// الحذف لا يمس سجل المستخدم ولا يحذف الموظف فعلياً - delete never touches the linked account or physically removes the row

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fail, ok, readJsonBody } from "@/lib/http";
import { canDeleteEmployee, canUpdateEmployee } from "@/lib/permissions";
import { EMPLOYEE_STATUSES, isEmployeeStatus } from "@/lib/employee-status";
import { isValidEmail } from "@/lib/password-policy";

// الحالات المعروضة في تفاصيل خطأ الحالة - advertised in INVALID_STATUS details
const ALLOWED_EMPLOYEE_STATUSES = EMPLOYEE_STATUSES;

// حقل التحديث المسموح فقط - only allowlisted fields reach Prisma
// كائن تراكمي يُبنى من الجسم، لذلك طفره مقصودة - accumulator built from the body, so mutation is intentional
type EmployeePatch = {
  name?: string;
  department?: string | null;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string;
  updatedBy: string;
};

// PATCH /api/employees/:id
// تعديل بيانات الموظف - update employee fields
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canUpdateEmployee(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    // Next.js 16: معاملات المسار Promise ويجب انتظارها - Next.js 16 route params are a Promise and must be awaited
    const { id } = await ctx.params;

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) return fail("EMPLOYEE_NOT_FOUND", "الموظف غير موجود - employee not found", 404);
    if (existing.deletedAt !== null) {
      return fail("EMPLOYEE_DELETED", "الموظف محذوف - employee is deleted", 409);
    }

    const parsed = await readJsonBody<Record<string, unknown>>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return fail("INVALID_BODY", "صيغة الطلب غير صحيحة - JSON body must be an object", 400);
    }

    const data: EmployeePatch = { updatedBy: s.sub };

    // الاسم مطلوب في المخطط، لذلك تبقى القيمة الفارغة نصاً فارغاً لا null
    // name is non-nullable in the schema, so an empty value stays an empty string
    if ("name" in body) {
      data.name = String(body.name ?? "").trim();
    }

    // الحقول الاختيارية: النص الفارغ يُخزن كـ null - optional fields: empty string is stored as null
    if ("department" in body) {
      const value = String(body.department ?? "").trim();
      data.department = value === "" ? null : value;
    }
    if ("title" in body) {
      const value = String(body.title ?? "").trim();
      data.title = value === "" ? null : value;
    }
    if ("phone" in body) {
      const value = String(body.phone ?? "").trim();
      data.phone = value === "" ? null : value;
    }

    if ("email" in body) {
      const value = String(body.email ?? "").trim();
      if (value === "") {
        data.email = null;
      } else if (!isValidEmail(value)) {
        return fail("INVALID_EMAIL", "بريد إلكتروني غير صالح - invalid email", 400, { received: body.email });
      } else {
        data.email = value;
      }
    }

    if ("status" in body) {
      const value = String(body.status ?? "").trim();
      if (!isEmployeeStatus(value)) {
        return fail("INVALID_STATUS", "حالة غير صالحة - invalid status", 400, {
          received: body.status,
          allowed: ALLOWED_EMPLOYEE_STATUSES,
        });
      }
      data.status = value;
    }

    const employee = await prisma.employee.update({ where: { id }, data });
    return ok({ employee });
  } catch (e) {
    console.error("EMPLOYEE_PATCH_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}

// DELETE /api/employees/:id
// حذف ناعم للموظف فقط - soft-delete the employee row only
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canDeleteEmployee(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    const { id } = await ctx.params;

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) return fail("EMPLOYEE_NOT_FOUND", "الموظف غير موجود - employee not found", 404);
    if (existing.deletedAt !== null) {
      return fail("EMPLOYEE_ALREADY_DELETED", "الموظف محذوف بالفعل - employee already deleted", 409);
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: s.sub },
      select: { id: true, deletedAt: true },
    });
    return ok({ employee });
  } catch (e) {
    console.error("EMPLOYEE_DELETE_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
