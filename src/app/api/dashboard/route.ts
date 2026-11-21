import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const today = new Date(); today.setUTCHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  const [employeeCount, todayRecords, pendingLeaves, recentAttendance] = await Promise.all([
    prisma.employee.count(),
    prisma.attendanceRecord.findMany({ where: { date: { gte: today, lt: tomorrow } } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.attendanceRecord.findMany({ include: { employee: { select: { employeeCode: true, name: true, department: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 10 }),
  ]);
  const stats = {
    employees: employeeCount,
    presentToday: todayRecords.filter(r => ["PRESENT","GRACE","LATE","INCOMPLETE"].includes(r.status)).length,
    lateToday: todayRecords.filter(r => r.status === "LATE").length,
    graceToday: todayRecords.filter(r => r.status === "GRACE").length,
    incompleteToday: todayRecords.filter(r => r.status === "INCOMPLETE").length,
    pendingLeaves,
  };
  return NextResponse.json({ stats, recentAttendance });
}
