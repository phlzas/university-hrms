import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { classifyAttendance } from "@/lib/attendance";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const status = searchParams.get("status");
  const where: any = {};
  if (date) {
    const d = new Date(date + "T00:00:00Z");
    const next = new Date(d); next.setUTCDate(next.getUTCDate() + 1);
    where.date = { gte: d, lt: next };
  }
  if (status) where.status = status;
  const records = await prisma.attendanceRecord.findMany({
    where,
    include: { employee: { select: { employeeCode: true, name: true, department: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  const filtered = q ? records.filter(r => r.employee.name.toLowerCase().includes(q) || r.employee.employeeCode.toLowerCase().includes(q)) : records;
  return NextResponse.json({ records: filtered });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (s.role === "VIEWER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await req.json();
  const employeeCode = String(body.employeeCode || "").trim();
  const dateStr = String(body.date || "").trim();
  const checkIn = body.checkIn ? String(body.checkIn) : null;
  const checkOut = body.checkOut ? String(body.checkOut) : null;
  if (!employeeCode || !dateStr) return NextResponse.json({ error: "employeeCode and date required" }, { status: 400 });
  let emp = await prisma.employee.findUnique({ where: { employeeCode } });
  if (!emp) emp = await prisma.employee.create({ data: { employeeCode, name: String(body.employeeName || employeeCode) } });
  const date = new Date(dateStr + "T00:00:00Z");
  const { status, minutesLate } = classifyAttendance(checkIn, checkOut, "08:00", 20);
  const rec = await prisma.attendanceRecord.create({ data: { employeeId: emp.id, date, checkIn, checkOut, status, minutesLate, source: "MANUAL" } });
  return NextResponse.json({ record: rec }, { status: 201 });
}
