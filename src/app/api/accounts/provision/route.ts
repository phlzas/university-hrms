// src/app/api/accounts/provision/route.ts
// تفعيل حساب موظف وإصدار دعوة لمرة واحدة - provision an employee account and issue a one-time invite
// الدور يُفرض دائماً EMPLOYEE ولا يُقرأ من الطلب - role is always forced to EMPLOYEE, never read from the body

import { randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fail, ok, readJsonBody } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { canProvisionAccount, ROLES } from "@/lib/permissions";
import { createInviteToken } from "@/lib/invite-token";
import { isValidEmail } from "@/lib/password-policy";
import { isEmployeeTombstoned } from "@/lib/account-access";

// POST /api/accounts/provision
// إنشاء حساب الموظف ورمز دعوة يُعرض مرة واحدة فقط - create the account and a single-use invite token
export async function POST(req: Request) {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canProvisionAccount(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    const parsed = await readJsonBody<Record<string, unknown>>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return fail("INVALID_BODY", "صيغة الطلب غير صحيحة - JSON body must be an object", 400);
    }

    // أي وجود لمفتاح role مرفوض، حتى لو كانت قيمته فارغة - any role key is rejected, even with an empty value
    if ("role" in body) {
      return fail("INVALID_ROLE", "لا يمكن تحديد الدور في الطلب - role must not be supplied in the request", 400, {
        received: body.role,
      });
    }

    const employeeCode = String(body.employeeId ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return fail("INVALID_EMAIL", "بريد إلكتروني غير صالح - invalid email", 400, { received: body.email });
    }

    // employeeId في الطلب يقابل employeeCode في قاعدة البيانات - request employeeId maps to Employee.employeeCode
    const employee = await prisma.employee.findUnique({
      where: { employeeCode },
      include: { account: { select: { id: true } } },
    });
    if (!employee) return fail("EMPLOYEE_NOT_FOUND", "الموظف غير موجود - employee not found", 404);
    if (isEmployeeTombstoned(employee.deletedAt)) {
      return fail("EMPLOYEE_DELETED", "الموظف محذوف - employee is deleted", 409);
    }
    if (employee.account !== null) {
      return fail("ACCOUNT_EXISTS", "الحساب موجود بالفعل - account already exists", 409);
    }
    const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (emailOwner !== null) {
      return fail("EMAIL_IN_USE", "البريد الإلكتروني مستخدم بالفعل - email already in use", 409);
    }

    // كلمة مرور عشوائية لا يعرفها أحد؛ الدعوة تعيّن كلمة المرور الحقيقية لاحقاً
    // Unknowable random password; the invite later sets the real one
    const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
    const { token, tokenHash, expiresAt } = createInviteToken();

    // المستخدم والرمز يُنشآن معاً؛ الرمز الخام لا يُحفظ أبداً
    // User and token are created together; the raw token is never persisted
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: employee.name,
          passwordHash,
          role: ROLES.EMPLOYEE,
          active: true,
          employeeId: employee.id,
          provisionedBy: s.sub,
        },
      });
      await tx.inviteToken.create({
        data: { tokenHash, userId: user.id, expiresAt },
      });
    });

    return ok(
      {
        account: { email, role: ROLES.EMPLOYEE, employeeId: employee.employeeCode },
        inviteUrl: `/invite?token=${token}`,
        expiresAt,
      },
      201
    );
  } catch (e) {
    console.error("ACCOUNT_PROVISION_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
