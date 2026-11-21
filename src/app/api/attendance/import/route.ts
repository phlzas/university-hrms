import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { classifyAttendance, normalizeDate, normalizeTime } from "@/lib/attendance";
import * as XLSX from "xlsx";

function norm(k: string) { return k.toLowerCase().replace(/[\s_\-\.]/g, ""); }
function pick(row: Record<string, unknown>, keys: string[]) {
  for (const [k, v] of Object.entries(row)) { const nk = norm(k); if (keys.some(kk => nk === norm(kk) || nk.includes(norm(kk)))) return v; }
  return undefined;
}
const ID_KEYS = ["id","employeeid","employee_id","empid","emp_id","رقم","الرقم","رقمالموظف","كودالموظف","المعرف"];
const NAME_KEYS = ["name","names","employee","employeename","employee_name","اسم","الاسم","اسمالموظف","الموظف","الأسماء"];
const DATE_KEYS = ["date","day","التاريخ","اليوم","تاريخ"];
const IN_KEYS = ["checkin","check_in","in","timein","time_in","arrival","quentin","دخول","وقتالدخول","الحضور","وقتالحضور"];
const OUT_KEYS = ["checkout","check_out","out","timeout","time_out","departure","خروج","وقتالخروج","الانصراف","وقتالانصراف"];

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (s.role === "VIEWER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  let imported = 0; const warnings: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawId = pick(row, ID_KEYS); const rawName = pick(row, NAME_KEYS); const rawDate = pick(row, DATE_KEYS);
    const rawIn = pick(row, IN_KEYS); const rawOut = pick(row, OUT_KEYS);
    const date = normalizeDate(rawDate) ?? normalizeDate(rawIn) ?? normalizeDate(rawOut);
    const checkIn = normalizeTime(rawIn); const checkOut = normalizeTime(rawOut);
    const employeeCode = String(rawId ?? "").trim(); const employeeName = String(rawName ?? "").trim();
    if (!date && !employeeCode && !employeeName && !checkIn && !checkOut) continue;
    if (!employeeCode && !employeeName) { warnings.push(`صف ${i + 2}: بدون معرف/اسم`); continue; }
    if (!date) { warnings.push(`صف ${i + 2}: تاريخ غير صالح`); continue; }
    const code = employeeCode || employeeName;
    let emp = await prisma.employee.findUnique({ where: { employeeCode: code } });
    if (!emp) emp = await prisma.employee.create({ data: { employeeCode: code, name: employeeName || `موظف ${code}` } });
    const { status, minutesLate } = classifyAttendance(checkIn, checkOut, "08:00", 20);
    await prisma.attendanceRecord.create({ data: { employeeId: emp.id, date, checkIn, checkOut, status, minutesLate, source: "IMPORT" } });
    imported++;
  }
  return NextResponse.json({ imported, warnings, totalRows: rows.length });
}
