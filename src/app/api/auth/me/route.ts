import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

// GET /api/auth/me
// إرجاع المستخدم الحالي من الجلسة - return current authenticated user from session cookie
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);

    // نقرأ المستخدم من قاعدة البيانات للتأكد أنه ما زال فعالاً - verify user still exists/active
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        employee: { select: { deletedAt: true } },
      },
    });
    if (!user || !user.active || user.employee?.deletedAt != null) {
      return fail("UNAUTHORIZED", "الجلسة غير صالحة - session no longer valid", 401);
    }

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: user.active,
      },
    });
  } catch (e) {

    console.error("AUTH_ME_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
