import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/auth";
import { fail, ok, readJsonBody } from "@/lib/http";

// POST /api/auth/login
// تسجيل الدخول وإنشاء جلسة - authenticate user and create session cookie
export async function POST(req: Request) {
  try {
    // قراءة JSON بأمان - safe JSON parsing (returns 400 on malformed JSON, not 500)
    const parsed = await readJsonBody<{ email?: unknown; password?: unknown }>(req);
    if ("error" in parsed) return parsed.error;

    const email = String(parsed.data.email ?? "").toLowerCase().trim();
    const password = String(parsed.data.password ?? "");

    // تحقق من الحقول المطلوبة - required fields validation
    if (!email || !password) {
      return fail("MISSING_CREDENTIALS", "البريد الإلكتروني وكلمة المرور مطلوبان - email and password are required", 400);
    }

    const invalidCredentials = () => fail("INVALID_CREDENTIALS", "بيانات الدخول غير صحيحة - invalid email or password", 401);

    // جلب المستخدم مع حالة الموظف المرتبط - lookup user by email including linked employee tombstone state
    const user = await prisma.user.findUnique({
      where: { email },
      include: { employee: { select: { deletedAt: true } } },
    });
    if (!user || !user.active) {
      // لا نكشف هل البريد موجود أم لا - avoid leaking whether email exists
      return invalidCredentials();
    }

    // التحقق من كلمة المرور - verify password hash
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return invalidCredentials();
    }

    // الموظف المؤرشف يُرفض بنفس خطأ كلمة المرور - tombstoned employee gets the identical error, checked after hashing to avoid timing leaks
    if (user.employee?.deletedAt != null) {
      return invalidCredentials();
    }

    // إنشاء جلسة JWT في كوكي - create JWT session cookie

    await createSession({ sub: user.id, email: user.email, role: user.role, name: user.name });

    return ok({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    // خطأ غير متوقع من السيرفر - unexpected server-side error
    console.error("LOGIN_ERROR", e);

    return fail("INTERNAL_ERROR", "حدث خطأ داخلي في الخادم - internal server error", 500);
  }
}
