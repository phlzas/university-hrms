// src/app/(app)/attendance/[id]/page.tsx
// صفحة تفاصيل سجل الحضور - Attendance record detail screen
// معاملات المسار Promise في Next 16 وتُقرأ داخل Suspense بسبب cacheComponents
// Next 16 route params are Promises and must be read inside Suspense with cacheComponents
// الحالة والتأخير من المصنّف على الخادم فقط - status/minutesLate come from the server classifier only

import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canUpdate } from "@/lib/permissions";
import AttendanceDetailEditor, { type AttendanceDetail } from "@/components/attendance-detail-editor";

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "حاضر",
  GRACE: "سماح",
  LATE: "متأخر",
  ABSENT: "غائب",
  INCOMPLETE: "غير مكتمل",
  LEAVE: "إجازة",
};

type PageProps = { params: Promise<{ id: string }> };

export default function AttendanceDetailPage({ params }: PageProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">تفاصيل سجل الحضور</h1>
          <p className="page-sub">عرض بيانات الحضور وتعديل أوقات الدخول والخروج</p>
        </div>
        <Link href="/attendance" className="btn btn-ghost">العودة إلى القائمة</Link>
      </header>
      {/* المحتوى الديناميكي داخل Suspense - dynamic content inside a Suspense boundary */}
      <Suspense fallback={<div className="page-card app-card muted">جاري تحميل السجل...</div>}>
        <AttendanceDetailContent params={params} />
      </Suspense>
    </div>
  );
}

async function AttendanceDetailContent({ params }: PageProps) {
  // Next.js 16: معاملات المسار Promise ويجب انتظارها - Next.js 16 route params are a Promise and must be awaited
  const { id } = await params;
  const session = await getSession();

  // حماية القراءة: جلسة صالحة مطلوبة - a valid session is required to read details
  if (!session) {
    return (
      <section className="page-card app-card" data-testid="attendance-unauthorized">
        <div className="page-card-header"><h2 className="page-card-title">يرجى تسجيل الدخول</h2></div>
        <p className="text-sm muted">تحتاج إلى جلسة صالحة لعرض تفاصيل الحضور.</p>
      </section>
    );
  }

  // التعديل من مصفوفة الصلاحيات المشتركة - edit gate comes from the shared role matrix
  const canEdit = canUpdate(session.role);

  const record = await prisma.attendanceRecord.findUnique({
    where: { id },
    include: { employee: true },
  });

  // معرف غير موجود => واجهة خطأ واضحة بدل الانهيار - missing id => clear error UI instead of a crash
  if (!record) {
    return (
      <section className="page-card app-card" data-testid="attendance-notfound">
        <div className="page-card-header"><h2 className="page-card-title">سجل غير موجود</h2></div>
        <p className="text-sm muted">لم يتم العثور على سجل الحضور المطلوب ({id}).</p>
        <div className="form-actions">
          <Link href="/attendance" className="btn btn-ghost">العودة إلى الحضور والانصراف</Link>
        </div>
      </section>
    );
  }

  // تحويل التواريخ إلى نصوص قابلة للإرسال للعميل - serialize dates for the client component
  const detail: AttendanceDetail = {
    id: record.id,
    date: record.date.toISOString().slice(0, 10),
    checkIn: record.checkIn,
    checkOut: record.checkOut,
    status: record.status,
    minutesLate: record.minutesLate,
    source: record.source,
    notes: record.notes,
    employee: {
      id: record.employee.id,
      name: record.employee.name,
      employeeCode: record.employee.employeeCode,
      department: record.employee.department,
      title: record.employee.title,
    },
  };

  return <AttendanceDetailEditor initial={detail} canEdit={canEdit} statusLabel={STATUS_LABEL} />;
}
