"use client";
// صفحة تفاصيل طلب الإجازة - Leave request detail screen (read + ADMIN/HR status actions)

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/use-session";

// تسميات العرض - display labels kept local to avoid cross-file coupling
const typeLabel: Record<string, string> = { annual: "سنوية", sick: "مرضية", emergency: "طارئة" };
const statusLabel: Record<string, string> = { PENDING: "قيد المراجعة", APPROVED: "مقبولة", REJECTED: "مرفوضة" };

// استخراج رسالة الخطأ من عقد API الموحد - extract message from unified ok/fail API contract
function getErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const body = data as Record<string, unknown>;
  if (typeof body.error === "string") return body.error;
  if (body.error && typeof body.error === "object") {
    const err = body.error as Record<string, unknown>;
    if (typeof err.message === "string") return err.message;
  }
  if (typeof body.message === "string") return body.message;
  return fallback;
}

// تنسيق التاريخ للعرض - format ISO/date value for display (YYYY-MM-DD)
function fmtDate(value: unknown): string {
  if (!value) return "—";
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

// تنسيق التاريخ والوقت لبيانات القرار - format decision timestamp for display
function fmtDateTime(value: unknown): string {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

type LeaveEmployee = { id?: string; name?: string; employeeCode?: string; department?: string | null };
type LeaveDetail = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string | null;
  status: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  employee?: LeaveEmployee | null;
};

type PageProps = { params: Promise<{ id: string }> };

export default function LeaveDetailPage({ params }: PageProps) {
  // Next 16: params Promise يجب فكّه عبر use() في مكوّن عميل - unwrap Promise params via React.use()
  const { id } = use(params);

  const session = useSession();
  const [leave, setLeave] = useState<LeaveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string>("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // تحميل تفاصيل الإجازة من API - load leave detail; keeps UI in sync after actions/reload
  const loadLeave = useCallback(async () => {
    if (!id) {
      setError("معرّف طلب الإجازة مفقود - missing leave id");
      setLeave(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/leaves/${encodeURIComponent(id)}`, { cache: "no-store" });
      const d: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setLeave(null);
        setError(getErrorMessage(d, "تعذر تحميل طلب الإجازة - failed to load leave request"));
        return;
      }
      const body = d as { leave?: LeaveDetail };
      setLeave(body.leave ?? null);
    } catch {
      setLeave(null);
      setError("تعذر الاتصال بالخادم - network error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadLeave();
  }, [loadLeave]);

  // تنفيذ قرار الحالة (ADMIN/HR فقط) ثم إعادة التحميل لضمان التطابق مع الخادم
  // Perform status action (ADMIN/HR only) then reload from server to avoid stale/misleading UI
  async function updateStatus(nextStatus: "APPROVED" | "REJECTED" | "PENDING") {
    if (!id) return;
    setActionLoading(nextStatus);
    setNotice("");
    setError("");
    try {
      const r = await fetch(`/api/leaves/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const d: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setError(getErrorMessage(d, "فشل تحديث حالة الإجازة - failed to update leave status"));
        return;
      }
      const body = d as { leave?: LeaveDetail };
      if (body.leave) setLeave(body.leave); // تحديث فوري من الاستجابة - immediate update from response
      setNotice(
        nextStatus === "APPROVED"
          ? "تمت الموافقة على الطلب"
          : nextStatus === "REJECTED"
            ? "تم رفض الطلب"
            : "تمت إعادة الطلب إلى قيد المراجعة"
      );
      await loadLeave(); // إعادة تحميل للتأكد من الثبات بعد إعادة الفتح/التحديث - reload for persistence truth
    } catch {
      setError("تعذر الاتصال بالخادم أثناء تحديث الحالة - network error while updating status");
    } finally {
      setActionLoading("");
    }
  }

  // قرار الحالة عملية تحديث: HR و HR_SUPER_ADMIN فقط - status decision is an update: HR/HR_SUPER_ADMIN only
  const canDecide = session.canUpdate;
  const statusClass = leave?.status ? `status s-${leave.status}` : "status";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">تفاصيل طلب الإجازة</h1>
          <p className="page-sub">مراجعة بيانات الطلب واتخاذ القرار — Leave request details</p>
        </div>
        <Link href="/leaves" className="btn btn-ghost self-start" data-testid="leave-back-link">
          العودة إلى الإجازات
        </Link>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status" data-testid="leave-notice">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert" data-testid="leave-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="app-card page-card">
          <div className="py-10 text-center muted">جاري تحميل تفاصيل الإجازة...</div>
        </div>
      ) : !leave ? (
        <div className="app-card page-card" data-testid="leave-not-found">
          <div className="space-y-3 py-6 text-center">
            <div className="text-lg font-bold text-slate-800">طلب الإجازة غير موجود</div>
            <p className="muted text-sm">تعذر العثور على الطلب المطلوب. قد يكون المعرف غير صحيح أو تم حذف الطلب.</p>
            <Link href="/leaves" className="btn btn-primary inline-flex">العودة إلى سجل الإجازات</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:gap-5 xl:grid-cols-3">
          <section className="app-card page-card xl:col-span-2" data-testid="leave-detail-card">
            <div className="page-card-header">
              <h2 className="page-card-title">بيانات الطلب</h2>
              <span className={statusClass} data-testid="leave-status">{statusLabel[leave.status] || leave.status}</span>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <dt className="text-xs font-semibold text-slate-500">الموظف</dt>
                <dd className="mt-1 text-base font-bold text-slate-800" data-testid="leave-employee-name">{leave.employee?.name || "—"}</dd>
                <dd className="mt-1 text-sm text-slate-600" data-testid="leave-employee-code">الرمز: {leave.employee?.employeeCode || "—"}</dd>
                <dd className="text-sm text-slate-600" data-testid="leave-employee-dept">القسم: {leave.employee?.department || "—"}</dd>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <dt className="text-xs font-semibold text-slate-500">نوع الإجازة</dt>
                <dd className="mt-1 text-base font-bold text-slate-800" data-testid="leave-type">{typeLabel[leave.type] || leave.type}</dd>
                <dd className="mt-1 text-sm text-slate-600" data-testid="leave-days">عدد الأيام: {leave.days ?? "—"}</dd>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <dt className="text-xs font-semibold text-slate-500">الفترة</dt>
                <dd className="mt-1 text-sm text-slate-700" data-testid="leave-start">من: {fmtDate(leave.startDate)}</dd>
                <dd className="text-sm text-slate-700" data-testid="leave-end">إلى: {fmtDate(leave.endDate)}</dd>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <dt className="text-xs font-semibold text-slate-500">بيانات القرار</dt>
                <dd className="mt-1 text-sm text-slate-700" data-testid="leave-decided-by">بواسطة: {leave.decidedBy || "—"}</dd>
                <dd className="text-sm text-slate-700" data-testid="leave-decided-at">وقت القرار: {fmtDateTime(leave.decidedAt)}</dd>
              </div>
            </dl>

            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <dt className="text-xs font-semibold text-slate-500">السبب</dt>
              <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800" data-testid="leave-reason">
                {leave.reason?.trim() ? leave.reason : "— لا يوجد سبب مسجل"}
              </dd>
            </div>
          </section>

          <section className="app-card page-card" data-testid="leave-actions-card">
            <div className="page-card-header">
              <h2 className="page-card-title">الإجراءات</h2>
            </div>

            {canDecide ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  يمكن لمسؤول النظام أو الموارد البشرية تحديث حالة الطلب. يتم حفظ القرار مع المستخدم والوقت.
                </p>
                <div className="form-actions flex-col sm:flex-row xl:flex-col">
                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    onClick={() => updateStatus("APPROVED")}
                    disabled={!!actionLoading}
                    data-testid="leave-approve-btn"
                  >
                    {actionLoading === "APPROVED" ? "جارٍ الاعتماد..." : "اعتماد الطلب"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost w-full border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                    onClick={() => updateStatus("REJECTED")}
                    disabled={!!actionLoading}
                    data-testid="leave-reject-btn"
                  >
                    {actionLoading === "REJECTED" ? "جارٍ الرفض..." : "رفض الطلب"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost w-full"
                    onClick={() => updateStatus("PENDING")}
                    disabled={!!actionLoading}
                    data-testid="leave-pending-btn"
                  >
                    {actionLoading === "PENDING" ? "جارٍ التحديث..." : "إعادة إلى قيد المراجعة"}
                  </button>
                </div>
                <p className="text-xs muted">
                  عند إعادة الطلب إلى "قيد المراجعة" يتم مسح بيانات القرار تلقائيًا.
                </p>
              </div>
            ) : (
              <div className="space-y-3" data-testid="leave-readonly-note">
                <p className="text-sm text-slate-600">
                  يمكنك عرض تفاصيل الطلب فقط. إجراءات الاعتماد والرفض متاحة لمسؤول النظام أو الموارد البشرية.
                </p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  الصلاحية الحالية: {session.role || "غير معروفة"}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
