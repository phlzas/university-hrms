import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fail, ok, readJsonBody } from "@/lib/http";
import { canRead, canUpdate } from "@/lib/permissions";

// Next 16: dynamic route params are Promise-based - معاملات المسار الديناميكية Promise في Next 16
type LeaveDetailContext = { params: Promise<{ id: string }> };

// الحالات المسموح بها - allowed leave statuses (kept as strings for Prisma's String field)
const ALLOWED_STATUSES: string[] = ["PENDING", "APPROVED", "REJECTED"];

// GET /api/leaves/:id
// جلب طلب إجازة واحد مع ملخص الموظف - fetch one leave request with employee summary
export async function GET(_req: Request, ctx: LeaveDetailContext) {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canRead(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    const { id } = await ctx.params;
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, name: true, employeeCode: true, department: true },
        },
      },
    });
    // طلب غير موجود - missing leave request
    if (!leave) return fail("LEAVE_NOT_FOUND", "طلب الإجازة غير موجود - leave request not found", 404);

    return ok({ leave });
  } catch (e) {
    console.error("LEAVE_DETAIL_GET_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}

// PATCH /api/leaves/:id
// تحديث حالة طلب الإجازة مع بيانات القرار - update leave status with decision metadata
export async function PATCH(req: Request, ctx: LeaveDetailContext) {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canUpdate(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    const { id } = await ctx.params;

    // قراءة JSON بأمان - safe JSON parsing (400 INVALID_JSON on malformed body)
    const parsed = await readJsonBody<{ status?: unknown }>(req);
    if ("error" in parsed) return parsed.error;

    const status = String(parsed.data?.status ?? "").trim().toUpperCase();
    // حالة غير صالحة - invalid status is a client error with an informative code
    if (!ALLOWED_STATUSES.includes(status)) {
      return fail(
        "INVALID_STATUS",
        "حالة غير صالحة - status must be PENDING, APPROVED or REJECTED",
        400,
        { received: parsed.data?.status ?? null, allowed: ALLOWED_STATUSES }
      );
    }

    // تحقق من وجود الطلب قبل التحديث - verify the record exists before updating
    const existing = await prisma.leaveRequest.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return fail("LEAVE_NOT_FOUND", "طلب الإجازة غير موجود - leave request not found", 404);

    // عند الموافقة/الرفض نسجل صاحب القرار ووقته، وعند الإعادة لـ PENDING نمسح البيانات
    // On APPROVED/REJECTED record the decision maker/time; on PENDING clear that metadata
    const isDecision = status === "APPROVED" || status === "REJECTED";
    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        decidedBy: isDecision ? s.sub || s.email : null,
        decidedAt: isDecision ? new Date() : null,
      },
      include: {
        employee: {
          select: { id: true, name: true, employeeCode: true, department: true },
        },
      },
    });

    return ok({ leave });
  } catch (e) {
    console.error("LEAVE_DETAIL_PATCH_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
