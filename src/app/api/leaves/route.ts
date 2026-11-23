import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fail, ok, readJsonBody } from "@/lib/http";
import { canCreate, canRead } from "@/lib/permissions";

// GET /api/leaves
// جلب طلبات الإجازة - list leave requests with employee summary
export async function GET() {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canRead(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);
    const leaves = await prisma.leaveRequest.findMany({
      include: { employee: { select: { name: true, employeeCode: true, department: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok({ leaves });
  } catch (e) {
    console.error("LEAVES_GET_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}

// diffDays() => حساب عدد الأيام شامل البداية والنهاية - inclusive day count
function diffDays(a: Date, b: Date) {
  const ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.floor(ms / 86400000) + 1;
}

// POST /api/leaves
// إنشاء طلب إجازة جديد - create leave request (PENDING by default)
export async function POST(req: Request) {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canCreate(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    const parsed = await readJsonBody<any>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data || {};

    const employeeCode = String(body.employeeCode ?? "").trim();
    if (!employeeCode) return fail("MISSING_EMPLOYEE_CODE", "رقم الموظف مطلوب - employeeCode is required", 400);

    const employee = await prisma.employee.findUnique({ where: { employeeCode } });
    if (!employee) return fail("EMPLOYEE_NOT_FOUND", "الموظف غير موجود - employee not found", 404);

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    // تحقق من التواريخ - date validation
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return fail("INVALID_DATES", "تواريخ غير صالحة - startDate/endDate must be valid dates", 400);
    }
    if (endDate < startDate) {
      return fail("INVALID_DATE_RANGE", "تاريخ النهاية قبل البداية - endDate must be >= startDate", 400);
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        type: String(body.type || "annual"),
        startDate,
        endDate,
        days: diffDays(startDate, endDate),
        reason: body.reason ? String(body.reason) : null,
        status: "PENDING",
      },
    });
    return ok({ leave }, 201);
  } catch (e) {
    console.error("LEAVES_POST_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
