// src/app/api/auth/password/route.ts
// تغيير كلمة المرور الذاتي المرتبط بالجلسة - session-bound self-service password change
// لا رموز ولا بريد إلكتروني؛ يُحدَّث المستخدم الحالي فقط - no token or email; only the session user is updated

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fail, ok, readJsonBody } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isStrongPassword } from "@/lib/password-policy";

// POST /api/auth/password
// التحقق من كلمة المرور الحالية ثم حفظ الجديدة - verify the current password, then store the new one
export async function POST(req: Request) {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);

    const parsed = await readJsonBody<Record<string, unknown>>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return fail("INVALID_BODY", "صيغة الطلب غير صحيحة - JSON body must be an object", 400);
    }

    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    const user = await prisma.user.findUnique({
      where: { id: s.sub },
      select: { passwordHash: true },
    });
    if (!user) return fail("UNAUTHORIZED", "الجلسة غير صالحة - session no longer valid", 401);

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return fail("INVALID_CURRENT_PASSWORD", "كلمة المرور الحالية غير صحيحة - current password is incorrect", 400);
    }
    if (!isStrongPassword(newPassword)) {
      return fail("WEAK_PASSWORD", "كلمة المرور لا تستوفي الشروط - password does not meet strength requirements", 400);
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: s.sub }, data: { passwordHash } });

    return ok({});
  } catch (e) {
    console.error("PASSWORD_CHANGE_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
