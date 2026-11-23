// src/app/api/seed/route.ts
// تهيئة بيانات تجريبية واقعية - seed realistic demo data
// ينشئ مستخدمين، موظفين، حضور، إجازات، وملفات تجريبية - creates users, employees, attendance, leaves, demo files
// التهيئة آمنة عند التكرار: لا حذف للبيانات ولا إعادة تعيين كلمات المرور - idempotent: no deletes, no password resets

import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { getSession } from '@/lib/auth';
import { fail, ok } from '@/lib/http';
import { ROLES, canManageSystem } from '@/lib/permissions';
import type { Role } from '@/lib/permissions';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

type SeedUser = {
  email: string;
  name: string;
  password: string;
  role: Role;
};

const SEED_USERS: readonly SeedUser[] = [
  { email: 'admin@hrms.local', name: 'سارة العتيبي', password: 'Admin@12345', role: ROLES.ADMIN },
  { email: 'hr@hrms.local', name: 'محمد الحربي', password: 'Hr@12345', role: ROLES.HR },
  { email: 'viewer@hrms.local', name: 'نورة السالم', password: 'Viewer@12345', role: ROLES.VIEWER },
  { email: 'superadmin@hrms.local', name: 'مدير النظام الأعلى', password: 'SuperAdmin@12345', role: ROLES.HR_SUPER_ADMIN },
];

// ensureUser() => إنشاء المستخدم فقط إن لم يكن موجودًا - create a user only when missing; existing passwords untouched
async function ensureUser(spec: SeedUser) {
  const existing = await prisma.user.findUnique({ where: { email: spec.email } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email: spec.email,
      name: spec.name,
      passwordHash: await hashPassword(spec.password),
      role: spec.role,
    },
  });
}

function d(daysFromToday: number) {
  const t = new Date();
  const x = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + daysFromToday));
  return x;
}

export async function POST() {
  try {
    const s = await getSession();
    if (!s) return fail('UNAUTHORIZED', 'غير مصرح - authentication required', 401);
    if (!canManageSystem(s.role)) return fail('FORBIDDEN', 'غير مصرح - forbidden', 403);

    await mkdir(UPLOAD_DIR, { recursive: true });

    // Users - المستخدمون (findUnique + create: no duplicate inserts, no password reset)
    const [admin, hr, viewer] = await Promise.all(SEED_USERS.map(ensureUser));

    // Demo data - بيانات تجريبية: skip when already present to avoid duplicate rows on repeated POST
    const alreadySeeded = await prisma.employee.findUnique({ where: { employeeCode: 'EMP-001' } });
    if (!alreadySeeded) {
      // Employees - الموظفون
      const employeesData = [
        { employeeCode: 'EMP-001', name: 'أحمد الغامدي', department: 'الموارد البشرية', title: 'أخصائي موارد بشرية', status: 'ACTIVE' },
        { employeeCode: 'EMP-002', name: 'ليان المطيري', department: 'تقنية المعلومات', title: 'مطورة نظم', status: 'ACTIVE' },
        { employeeCode: 'EMP-003', name: 'خالد القحطاني', department: 'المالية', title: 'محاسب أول', status: 'ACTIVE' },
        { employeeCode: 'EMP-004', name: 'ريم الشمري', department: 'القبول والتسجيل', title: 'منسقة قبول', status: 'ACTIVE' },
        { employeeCode: 'EMP-005', name: 'عبدالله الدوسري', department: 'الشؤون الأكاديمية', title: 'مشرف أكاديمي', status: 'ACTIVE' },
        { employeeCode: 'EMP-006', name: 'هند الزهراني', department: 'الموارد البشرية', title: 'مسؤولة توظيف', status: 'ACTIVE' },
        { employeeCode: 'EMP-007', name: 'فهد العنزي', department: 'الخدمات العامة', title: 'منسق خدمات', status: 'ACTIVE' },
        { employeeCode: 'EMP-008', name: 'مي آل سعود', department: 'تقنية المعلومات', title: 'محللة بيانات', status: 'ACTIVE' },
      ];
      await prisma.employee.createMany({ data: employeesData });
      const employees = await prisma.employee.findMany({ orderBy: { employeeCode: 'asc' } });
      const byCode = Object.fromEntries(employees.map((e) => [e.employeeCode, e]));

      // Attendance - سجلات حضور واقعية لآخر أيام
      const attendanceRows: any[] = [];
      const patterns = [
        { in: '08:05', out: '16:02', status: 'GRACE', late: 0 },
        { in: '07:55', out: '16:10', status: 'PRESENT', late: 0 },
        { in: '08:35', out: '16:05', status: 'LATE', late: 15 },
        { in: '08:00', out: '16:00', status: 'PRESENT', late: 0 },
        { in: '08:18', out: '16:07', status: 'GRACE', late: 0 },
        { in: '09:10', out: '16:20', status: 'LATE', late: 50 },
        { in: '08:02', out: null, status: 'INCOMPLETE', late: 0 },
        { in: '07:50', out: '15:55', status: 'PRESENT', late: 0 },
      ];
      for (let day = -4; day <= 0; day++) {
        employees.forEach((emp, idx) => {
          const p = patterns[(idx + Math.abs(day)) % patterns.length];
          attendanceRows.push({ employeeId: emp.id, date: d(day), checkIn: p.in, checkOut: p.out, status: p.status, minutesLate: p.late, source: day === 0 ? 'MANUAL' : 'IMPORT' });
        });
      }
      await prisma.attendanceRecord.createMany({ data: attendanceRows });

      // Leaves - الإجازات
      await prisma.leaveRequest.createMany({
        data: [
          { employeeId: byCode['EMP-001'].id, type: 'annual', startDate: d(2), endDate: d(4), days: 3, reason: 'إجازة سنوية - Annual leave', status: 'PENDING' },
          { employeeId: byCode['EMP-003'].id, type: 'sick', startDate: d(-1), endDate: d(0), days: 2, reason: 'موعد طبي - Medical appointment', status: 'APPROVED', decidedBy: admin.email, decidedAt: new Date() },
          { employeeId: byCode['EMP-005'].id, type: 'emergency', startDate: d(1), endDate: d(1), days: 1, reason: 'ظرف عائلي - Family emergency', status: 'PENDING' },
          { employeeId: byCode['EMP-007'].id, type: 'annual', startDate: d(7), endDate: d(9), days: 3, reason: 'سفر - Travel', status: 'REJECTED', decidedBy: admin.email, decidedAt: new Date() },
        ],
      });

      // Demo files - ملفات تجريبية
      const mkFile = async (name: string, content: string) => { const stored = `seed-${Date.now()}-${name.replace(/[^a-zA-Z0-9.\-]/g,'_')}`; await writeFile(path.join(UPLOAD_DIR, stored), content, 'utf8'); return { stored, rel: `/uploads/${stored}`, size: Buffer.byteLength(content) }; };
      const f1 = await mkFile('policy.txt', 'سياسة الموارد البشرية - HR Policy\n\nهذا ملف تجريبي لعرض نظام الملفات.');
      const f2 = await mkFile('onboarding-checklist.txt', 'Onboarding Checklist\n- Contract\n- ID\n- System Access');
      const f3 = await mkFile('leave-template.txt', 'Leave Request Template\nEmployee:\nType:\nDates:');

      const rootHr = await prisma.document.create({ data: { name: 'سياسات الموارد البشرية', isDirectory: true, path: '/سياسات الموارد البشرية', uploadedBy: admin.name, uploadedById: admin.id, updatedById: admin.id, permissions: { create: [{ userId: admin.id, canView: true, grantedById: admin.id }, { userId: hr.id, canView: true, grantedById: admin.id }] } } });
      const rootTemplates = await prisma.document.create({ data: { name: 'نماذج جاهزة', isDirectory: true, path: '/نماذج جاهزة', uploadedBy: admin.name, uploadedById: admin.id, updatedById: admin.id, permissions: { create: [{ userId: admin.id, canView: true, grantedById: admin.id }, { userId: hr.id, canView: true, grantedById: admin.id }, { userId: viewer.id, canView: true, grantedById: admin.id }] } } });
      const docs = [
        { name: 'HR-Policy.txt', path: '/سياسات الموارد البشرية/HR-Policy.txt', parentId: rootHr.id, ...f1, mimeType: 'text/plain', by: admin },
        { name: 'Onboarding-Checklist.txt', path: '/سياسات الموارد البشرية/Onboarding-Checklist.txt', parentId: rootHr.id, ...f2, mimeType: 'text/plain', by: hr },
        { name: 'Leave-Template.txt', path: '/نماذج جاهزة/Leave-Template.txt', parentId: rootTemplates.id, ...f3, mimeType: 'text/plain', by: admin },
      ];
      for (const f of docs) {
        const permUsers = Array.from(new Set([f.by.id, admin.id]));
        const doc = await prisma.document.create({ data: { name: f.name, isDirectory: false, path: f.path, parentId: f.parentId, fileName: f.stored, filePath: f.rel, size: f.size, mimeType: f.mimeType, uploadedBy: f.by.name, uploadedById: f.by.id, updatedById: f.by.id, currentVersion: 1, permissions: { create: permUsers.map((uid) => ({ userId: uid, canView: true, grantedById: admin.id })) } } });
        await prisma.documentVersion.create({ data: { documentId: doc.id, version: 1, name: doc.name, fileName: doc.fileName, filePath: doc.filePath, mimeType: doc.mimeType, size: doc.size, uploadedBy: f.by.name, uploadedById: f.by.id, action: 'UPLOAD' } });
      }
    }

    return ok({
      message: 'البيانات موجودة بالفعل أو تم إنشاؤها - seed verified',
      users: {
        admin: 'admin@hrms.local / Admin@12345',
        hr: 'hr@hrms.local / Hr@12345',
        viewer: 'viewer@hrms.local / Viewer@12345',
        superAdmin: 'superadmin@hrms.local / SuperAdmin@12345',
      },
    });
  } catch (e) {
    // no-excuse-ok: catch - HTTP handler boundary: log and return unified 500
    console.error('SEED_ERROR', e);
    return fail('INTERNAL_ERROR', 'خطأ داخلي - internal server error', 500);
  }
}
