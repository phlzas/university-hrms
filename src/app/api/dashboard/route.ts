// src/app/api/dashboard/route.ts
// بيانات لوحة التحكم - dashboard summary stats + recent attendance

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fail, ok } from '@/lib/http';
import { canRead } from '@/lib/permissions';

export async function GET() {
  try {
    const s = await getSession();
    if (!s) return fail('UNAUTHORIZED', 'غير مصرح - authentication required', 401);
    if (!canRead(s.role)) return fail('FORBIDDEN', 'غير مصرح - forbidden', 403);

    const today = new Date();
    const start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);

    const [employees, attendanceToday, pendingLeaves, recentAttendance, leaves, docsCount] = await Promise.all([
      prisma.employee.count({ where: { deletedAt: null } }),
      prisma.attendanceRecord.findMany({ where: { date: { gte: start, lt: end } } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.attendanceRecord.findMany({ include: { employee: true }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 8 }),
      prisma.leaveRequest.findMany({ include: { employee: { select: { name: true, employeeCode: true, department: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.document.count({ where: { isDirectory: false } }),
    ]);

    return ok({
      stats: {
        employees,
        presentToday: attendanceToday.filter((a) => a.status === 'PRESENT').length,
        lateToday: attendanceToday.filter((a) => a.status === 'LATE').length,
        graceToday: attendanceToday.filter((a) => a.status === 'GRACE').length,
        incompleteToday: attendanceToday.filter((a) => a.status === 'INCOMPLETE').length,
        pendingLeaves,
        files: docsCount,
      },
      recentAttendance,
      recentLeaves: leaves,
    });
  } catch (e) {
    console.error('DASHBOARD_ERROR', e);
    return fail('INTERNAL_ERROR', 'خطأ داخلي - internal server error', 500);
  }
}