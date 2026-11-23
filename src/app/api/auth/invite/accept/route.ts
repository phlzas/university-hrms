// src/app/api/auth/invite/accept/route.ts
// قبول دعوة تفعيل الحساب لمرة واحدة - accept a one-time account activation invite
// الرمز يُستهلك ذرياً مع تحديث كلمة المرور - token consumption and password update happen atomically

import { prisma } from "@/lib/db";
import { fail, ok, readJsonBody } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { hashInviteToken } from "@/lib/invite-token";
import { isStrongPassword } from "@/lib/password-policy";
import { isEmployeeTombstoned } from "@/lib/account-access";

// POST /api/auth/invite/accept
// تعيين كلمة المرور النهائية واستهلاك الرمز - set the final password and consume the invite token
export async function POST(req: Request) {
  try {
    const parsed = await readJsonBody<Record<string, unknown>>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return fail("INVALID_BODY", "صيغة الطلب غير صحيحة - JSON body must be an object", 400);
    }

    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");
    if (!token || !password) {
      return fail("MISSING_FIELDS", "الرمز وكلمة المرور مطلوبان - token and password are required", 400, {
        required: ["token", "password"],
      });
    }
    if (!isStrongPassword(password)) {
      return fail("WEAK_PASSWORD", "كلمة المرور لا تستوفي الشروط - password does not meet strength requirements", 400);
    }

    const now = new Date();
    const tokenHash = hashInviteToken(token);
    const invite = await prisma.inviteToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { employee: { select: { deletedAt: true } } } } },
    });
    if (!invite || invite.consumedAt !== null || invite.expiresAt.getTime() <= now.getTime()) {
      return fail("INVALID_OR_EXPIRED_TOKEN", "رابط الدعوة غير صالح أو منتهي - invite token is invalid, consumed, or expired", 410);
    }
    if (isEmployeeTombstoned(invite.user.employee?.deletedAt ?? null)) {
      return fail("ACCOUNT_BLOCKED", "الحساب محجوب - account is blocked", 403);
    }

    const passwordHash = await hashPassword(password);

    // updateMany بشرط الاستهلاك والانتهاء يضمن لمرة واحدة حتى مع طلبات متزامنة
    // Conditional updateMany guarantees single use even under concurrent requests
    const consumed = await prisma.$transaction(async (tx) => {
      const result = await tx.inviteToken.updateMany({
        where: { tokenHash, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (result.count !== 1) return false;
      await tx.user.update({ where: { id: invite.userId }, data: { passwordHash } });
      return true;
    });
    if (!consumed) {
      return fail("INVALID_OR_EXPIRED_TOKEN", "رابط الدعوة غير صالح أو منتهي - invite token is invalid, consumed, or expired", 410);
    }

    return ok({});
  } catch (e) {
    console.error("INVITE_ACCEPT_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
