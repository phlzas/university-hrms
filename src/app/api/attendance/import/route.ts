import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { classifyAttendance, normalizeDate, normalizeTime } from "@/lib/attendance";
import { fail, ok } from "@/lib/http";
import { canImport } from "@/lib/permissions";

// مفاتيح الأعمدة المقبولة - accepted column keys (English/Arabic variants from HR files)
const EMP_KEYS = ["id","employeeid","employeecode","code","الرقم","رقم_الموظف","رقم الموظف"];
const NAME_KEYS = ["names","name","employeename","fullname","الاسم","اسم الموظف","اسم_الموظف"];
const IN_KEYS = ["quentin","checkin","in","timein","دخول","وقت الدخول","وقت_الدخول","حضور"];
const OUT_KEYS = ["out","checkout","timeout","خروج","وقت الخروج","وقت_الخروج","انصراف"];
const DATE_KEYS = ["date","day","التاريخ","تاريخ"];

// pick() => إيجاد أول قيمة مطابقة من الأعمدة المحتملة - find first matching column value
function pick(row: Record<string, unknown>, keys: string[]) {
  for (const [k, v] of Object.entries(row)) {
    const nk = k.toLowerCase().replace(/\s+|_/g, "");
    if (keys.some((key) => nk === key.toLowerCase().replace(/\s+|_/g, ""))) return v;
  }
  return undefined;
}

// POST /api/attendance/import
// استيراد ملف حضور Excel/CSV - import attendance from uploaded spreadsheet
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canImport(session.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return fail("MISSING_FILE", "ملف الاستيراد مطلوب - file is required", 400);

    // قراءة الملف وتحويله لصفوف - read workbook and convert first sheet to JSON rows
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    let imported = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const employeeCode = String(pick(row, EMP_KEYS) ?? "").trim();
      const name = String(pick(row, NAME_KEYS) ?? "").trim();
      const date = normalizeDate(pick(row, DATE_KEYS) ?? new Date());
      const checkIn = normalizeTime(pick(row, IN_KEYS));
      const checkOut = normalizeTime(pick(row, OUT_KEYS));

      // تحقق أساسي لكل صف - minimal per-row validation
      if (!employeeCode || !name || !date) {
        errors.push({ row: i + 2, error: "بيانات ناقصة - missing employeeCode/name/date" });
        continue;
      }

      // upsert الموظف لتسهيل الاستيراد - upsert employee so import can create missing staff records
      const employee = await prisma.employee.upsert({
        where: { employeeCode },
        update: { name },
        create: { employeeCode, name, status: "ACTIVE" },
      });

      const cls = classifyAttendance(checkIn, checkOut);
      // منع تكرار نفس اليوم لنفس الموظف - avoid duplicate same-day record
      const existing = await prisma.attendanceRecord.findFirst({ where: { employeeId: employee.id, date } });
      if (existing) {
        await prisma.attendanceRecord.update({ where: { id: existing.id }, data: { checkIn, checkOut, status: cls.status, minutesLate: cls.minutesLate, source: "IMPORT" } });
      } else {
        await prisma.attendanceRecord.create({ data: { employeeId: employee.id, date, checkIn, checkOut, status: cls.status, minutesLate: cls.minutesLate, source: "IMPORT" } });
      }
      imported++;
    }

    return ok({ imported, total: rows.length, errors: errors.slice(0, 50) });
  } catch (e) {
    console.error("ATTENDANCE_IMPORT_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي أثناء الاستيراد - internal server error during import", 500);
  }
}
