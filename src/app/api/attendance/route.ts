import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { normalizeDate, normalizeTime, classifyAttendance } from "@/lib/attendance";
import { fail, ok, readJsonBody } from "@/lib/http";
import { canCreate, canRead } from "@/lib/permissions";

// GET /api/attendance
// جلب سجلات الحضور مع فلاتر - list attendance records with optional filters (q/date/status)
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canRead(session.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const date = searchParams.get("date");
    const status = (searchParams.get("status") || "").trim();

    // بناء شروط البحث - build Prisma where clause
    const where: any = {};
    if (date) {
      const d = new Date(date);
      if (isNaN(d.getTime())) return fail("INVALID_DATE", "تاريخ غير صالح - invalid date filter", 400);
      const next = new Date(d); next.setUTCDate(d.getUTCDate() + 1);
      where.date = { gte: d, lt: next };
    }
    // السماح فقط بحالات معروفة - allow only known statuses
    const allowed = ["PRESENT", "GRACE", "LATE", "ABSENT", "INCOMPLETE", "LEAVE"];
    if (status) {
      if (!allowed.includes(status)) return fail("INVALID_STATUS", "حالة غير صالحة - invalid status filter", 400, { allowed });
      where.status = status;
    }
    if (q) where.employee = { OR: [{ name: { contains: q } }, { employeeCode: { contains: q } }] };

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: { employee: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    return ok({ records });
  } catch (e) {
    console.error("ATTENDANCE_GET_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}

// POST /api/attendance
// إنشاء سجل حضور يدوي - create a manual attendance record
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canCreate(session.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    const parsed = await readJsonBody<any>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data || {};

    const employeeCode = String(body.employeeCode ?? "").trim();
    if (!employeeCode) return fail("MISSING_EMPLOYEE_CODE", "رقم الموظف مطلوب - employeeCode is required", 400);

    const employee = await prisma.employee.findUnique({ where: { employeeCode } });
    if (!employee) return fail("EMPLOYEE_NOT_FOUND", "الموظف غير موجود - employee not found", 404);

    const date = normalizeDate(body.date);
    if (!date) return fail("INVALID_DATE", "التاريخ غير صالح - invalid or missing date", 400);

    const checkIn = normalizeTime(body.checkIn);
    const checkOut = normalizeTime(body.checkOut);
    // تصنيف الحالة بناء على وقت الدخول - classify status based on check-in/grace rules
    const cls = classifyAttendance(checkIn, checkOut);

    const record = await prisma.attendanceRecord.create({
      data: {
        employeeId: employee.id,
        date,
        checkIn,
        checkOut,
        status: cls.status,
        minutesLate: cls.minutesLate,
        source: "MANUAL",
        notes: body.notes ? String(body.notes) : null,
      },
    });
    return ok({ record }, 201);
  } catch (e) {
    console.error("ATTENDANCE_POST_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
