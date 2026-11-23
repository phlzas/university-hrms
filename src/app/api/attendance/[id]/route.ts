// src/app/api/attendance/[id]/route.ts
// تفاصيل سجل الحضور: قراءة وتعديل مع إعادة تصنيف الحالة - attendance detail: read and edit with status reclassification
// ملاحظة: التصنيف يمر دائماً عبر classifyAttendance، ولا يتم تعديل الحالة يدوياً - status always comes from the classifier, never accepted from the client

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { classifyAttendance, normalizeTime } from "@/lib/attendance";
import { fail, ok, readJsonBody } from "@/lib/http";
import { canRead, canUpdate } from "@/lib/permissions";

// GET /api/attendance/:id
// جلب سجل حضور واحد مع بيانات الموظف - fetch a single attendance record with its employee
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // حماية القراءة: جلسة صالحة بصلاحية القراءة - valid session with read capability
    const session = await getSession();
    if (!session) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canRead(session.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    // Next.js 16: معاملات المسار Promise ويجب انتظارها - Next.js 16 route params are a Promise and must be awaited
    const { id } = await params;
    const attendance = await prisma.attendanceRecord.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!attendance) return fail("NOT_FOUND", "سجل الحضور غير موجود - attendance record not found", 404);

    return ok({ attendance });
  } catch (e) {
    console.error("ATTENDANCE_DETAIL_GET_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}

// PATCH /api/attendance/:id
// تعديل أوقات الحضور والملاحظات مع إعادة حساب الحالة والتأخر - edit times/notes and recompute status + minutesLate
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canUpdate(session.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    const { id } = await params;
    const existing = await prisma.attendanceRecord.findUnique({ where: { id } });
    if (!existing) return fail("NOT_FOUND", "سجل الحضور غير موجود - attendance record not found", 404);

    const parsed = await readJsonBody<Record<string, unknown>>(req);
    if ("error" in parsed) return parsed.error;

    // حماية من جسم JSON ليس كائناً - guard against a valid JSON body that is not an object
    const body = parsed.data;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return fail("INVALID_BODY", "صيغة الطلب غير صحيحة - JSON body must be an object", 400);
    }

    // الحقول المسموح تعديلها: الدخول، الخروج، الملاحظات فقط - only checkIn/checkOut/notes are editable
    // التاريخ غير قابل للتعديل هنا (كما في المسار الافتراضي) - date is intentionally not editable here
    let checkIn = existing.checkIn;
    let checkOut = existing.checkOut;
    let notes = existing.notes;

    // null/"" يعني مسح الوقت؛ أي قيمة أخرى غير صالحة تُرفض - null/"" clears a time; any other invalid value is rejected
    if ("checkIn" in body) {
      const raw = body.checkIn;
      if (raw === null || raw === "") {
        checkIn = null;
      } else {
        const normalized = normalizeTime(raw);
        if (normalized === undefined) {
          return fail("INVALID_TIME", "وقت الدخول غير صالح - invalid checkIn time", 400, { field: "checkIn", received: raw });
        }
        checkIn = normalized;
      }
    }

    if ("checkOut" in body) {
      const raw = body.checkOut;
      if (raw === null || raw === "") {
        checkOut = null;
      } else {
        const normalized = normalizeTime(raw);
        if (normalized === undefined) {
          return fail("INVALID_TIME", "وقت الخروج غير صالح - invalid checkOut time", 400, { field: "checkOut", received: raw });
        }
        checkOut = normalized;
      }
    }

    if ("notes" in body) {
      const raw = body.notes;
      notes = raw === null || raw === "" ? null : String(raw);
    }

    // إعادة التصنيف من الأوقات الجديدة فقط - reclassify strictly from the new times via the shared classifier
    const cls = classifyAttendance(checkIn, checkOut);
    const attendance = await prisma.attendanceRecord.update({
      where: { id },
      data: {
        checkIn,
        checkOut,
        notes,
        status: cls.status,
        minutesLate: cls.minutesLate,
      },
      include: { employee: true },
    });

    return ok({ attendance });
  } catch (e) {
    console.error("ATTENDANCE_DETAIL_PATCH_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
