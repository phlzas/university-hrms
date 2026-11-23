"use client";
// src/components/attendance-detail-editor.tsx
// محرر تفاصيل الحضور - Attendance detail editor (client-side PATCH + refresh)
// الحالة والتأخير يأتيان من رد الخادم فقط عبر المصنّف - status/minutesLate come only from the server classifier response

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AttendanceDetail = {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  minutesLate: number;
  source: string;
  notes: string | null;
  employee: {
    id: string;
    name: string;
    employeeCode: string;
    department: string | null;
    title: string | null;
  };
};

type Props = {
  initial: AttendanceDetail;
  canEdit: boolean;
  statusLabel: Record<string, string>;
};

// صيغة الوقت 24 ساعة - strict 24-hour HH:MM guard
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// استخراج رسالة الخطأ الموحدة من الـ API - read the unified API error message
function errorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const obj = data as { error?: unknown };
  if (typeof obj.error === "string") return obj.error;
  if (obj.error && typeof obj.error === "object" && "message" in obj.error) {
    const message = (obj.error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function Field({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-2 last:border-0" data-testid={testId}>
      <dt className="text-sm muted">{label}</dt>
      <dd className="text-sm font-semibold text-[var(--text)] text-left">{value}</dd>
    </div>
  );
}

export default function AttendanceDetailEditor({ initial, canEdit, statusLabel }: Props) {
  const router = useRouter();
  const [record, setRecord] = useState<AttendanceDetail>(initial);
  const [checkIn, setCheckIn] = useState(initial.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initial.checkOut ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");

    // رفض الصيغة الخاطئة محلياً قبل الطلب - reject malformed times locally before the request
    if (checkIn !== "" && !TIME_PATTERN.test(checkIn)) {
      setError("صيغة وقت الدخول غير صالحة — استخدم HH:MM");
      return;
    }
    if (checkOut !== "" && !TIME_PATTERN.test(checkOut)) {
      setError("صيغة وقت الخروج غير صالحة — استخدم HH:MM");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/attendance/${encodeURIComponent(record.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkIn: checkIn === "" ? null : checkIn,
          checkOut: checkOut === "" ? null : checkOut,
          notes: notes === "" ? null : notes,
        }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessage(data, "فشل حفظ التعديلات"));
        return;
      }

      // تحديث الحالة والتأخير من رد الخادم فقط - take status/minutesLate from the server response only
      const payload = data as { attendance?: Partial<AttendanceDetail> } | null;
      const updated = payload?.attendance;
      if (updated) {
        setRecord((prev) => ({
          ...prev,
          checkIn: updated.checkIn ?? null,
          checkOut: updated.checkOut ?? null,
          notes: updated.notes ?? null,
          status: updated.status ?? prev.status,
          minutesLate: updated.minutesLate ?? prev.minutesLate,
        }));
        setCheckIn(updated.checkIn ?? "");
        setCheckOut(updated.checkOut ?? "");
        setNotes(updated.notes ?? "");
      }
      setMessage("تم حفظ التعديلات بنجاح");
      router.refresh(); // إعادة تحميل بيانات الخادم - refresh server-rendered data
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start">
      <section className="page-card app-card" data-testid="attendance-summary">
        <div className="page-card-header">
          <h2 className="page-card-title">بيانات السجل</h2>
          <span className={`status s-${record.status}`} data-testid="attendance-status">
            {statusLabel[record.status] ?? record.status}
          </span>
        </div>
        <dl className="page-card-body">
          <Field label="الموظف" value={record.employee.name} testId="detail-employee" />
          <Field label="الرمز الوظيفي" value={record.employee.employeeCode} />
          <Field label="القسم" value={record.employee.department ?? "-"} />
          <Field label="المسمى الوظيفي" value={record.employee.title ?? "-"} />
          <Field label="التاريخ" value={record.date} testId="detail-date" />
          <Field label="وقت الدخول" value={record.checkIn ?? "-"} testId="detail-checkin" />
          <Field label="وقت الخروج" value={record.checkOut ?? "-"} testId="detail-checkout" />
          <Field label="الدقائق المتأخرة" value={String(record.minutesLate)} testId="detail-minutes-late" />
          <Field label="المصدر" value={record.source} testId="detail-source" />
          <Field label="الملاحظات" value={record.notes ?? "-"} testId="detail-notes" />
        </dl>
      </section>

      {canEdit ? (
        <section className="page-card app-card" data-testid="attendance-edit-panel">
          <div className="page-card-header">
            <h2 className="page-card-title">تعديل السجل</h2>
            <span className="text-xs muted">الحالة تُحسب تلقائياً</span>
          </div>
          <form onSubmit={save} className="page-card-body">
            <div className="form-grid-2">
              <label className="block">
                <span className="block mb-1 text-sm font-semibold">وقت الدخول</span>
                <input type="time" className="input" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} data-testid="edit-checkin" />
              </label>
              <label className="block">
                <span className="block mb-1 text-sm font-semibold">وقت الخروج</span>
                <input type="time" className="input" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} data-testid="edit-checkout" />
              </label>
            </div>
            <label className="block">
              <span className="block mb-1 text-sm font-semibold">الملاحظات</span>
              <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="edit-notes" />
            </label>
            {error && <p role="alert" className="text-sm text-[var(--danger)]" data-testid="edit-error">{error}</p>}
            {message && <p role="status" className="text-sm text-[var(--ok)]" data-testid="edit-success">{message}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving} data-testid="edit-save">
                {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="page-card app-card" data-testid="attendance-readonly-note">
          <p className="text-sm muted">وضع العرض فقط — لا تملك صلاحية تعديل سجلات الحضور.</p>
        </section>
      )}
    </div>
  );
}
