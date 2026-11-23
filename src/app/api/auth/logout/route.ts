import { prisma } from "@/lib/db";
import { clearSession } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

// POST /api/auth/logout
// تسجيل الخروج ومسح الكوكي - clear session cookie and logout
export async function POST() {
  try {
    await clearSession();
    return ok({ message: "تم تسجيل الخروج - logged out" });
  } catch (e) {
    console.error("LOGOUT_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
