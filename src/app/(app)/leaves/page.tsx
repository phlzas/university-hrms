"use client";
// صفحة الإجازات - Leaves page: نموذج تقديم + جدول كبير مع تنقل واضح للتفاصيل
// Form + large table with clear detail navigation (Todo 5)

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/use-session";

// أنواع البيانات القادمة من API - types mirroring the API contract (no `any`)
type LeaveRecord = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason?: string | null;
  employee?: { name?: string; employeeCode?: string } | null;
};

type LeaveForm = {
  employeeCode: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
};

type Notice = { kind: "error" | "success"; text: string };

const EMPTY_FORM: LeaveForm = {
  employeeCode: "",
  type: "annual",
  startDate: "",
  endDate: "",
  reason: "",
};

const typeLabel: Record<string, string> = {
  annual: "سنوية",
  sick: "مرضية",
  emergency: "طارئة",
};
const statusLabel: Record<string, string> = {
  PENDING: "قيد المراجعة",
  APPROVED: "مقبولة",
  REJECTED: "مرفوضة",
};

// رسائل الخطأ الموحّدة: error.message أو error كنص - unified API errors: error.message or plain string
function getErrorMessage(data: unknown, fallback: string): string {
  if (typeof data !== "object" || data === null || !("error" in data)) return fallback;
  const error: unknown = data.error;
  if (typeof error === "string" && error.trim()) return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message: unknown = error.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

// قراءة آمنة لقائمة الإجازات - defensive parse of the leaves array
function readLeaves(data: unknown): LeaveRecord[] {
  if (typeof data !== "object" || data === null || !("leaves" in data)) return [];
  const raw: unknown = data.leaves;
  if (!Array.isArray(raw)) return [];
  const items: unknown[] = raw;
  return items.filter(
    (item): item is LeaveRecord =>
      typeof item === "object" && item !== null && "id" in item && typeof item.id === "string"
  );
}

export default function LeavesPage() {
  const { canCreate } = useSession();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [form, setForm] = useState<LeaveForm>(EMPTY_FORM);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/leaves");
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice({ kind: "error", text: getErrorMessage(data, "فشل تحميل الإجازات") });
        return;
      }
      setLeaves(readLeaves(data));
    } catch {
      // تعذر الاتصال بالخادم - network failure, keep the previous list intact
      setNotice({ kind: "error", text: "تعذر الاتصال بالخادم" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        // عرض خطأ الـ API كما هو - surface the API error verbatim (malformed input stays visible)
        setNotice({ kind: "error", text: getErrorMessage(data, "فشل إرسال الطلب") });
        return;
      }
      // النجاح فقط بعد 201 من API - success only after the API confirms creation
      setNotice({ kind: "success", text: "تم إرسال طلب الإجازة" });
      setForm(EMPTY_FORM);
      await load();
    } catch {
      setNotice({ kind: "error", text: "تعذر الاتصال بالخادم" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">الإجازات</h1>
        <p className="page-sub">تقديم ومتابعة طلبات الإجازة — Leave requests workflow</p>
      </div>

      {/* نموذج بجانب جدول كبير: عمود واحد على الهاتف، عمودان من xl
          Compact form beside a large table: one column on phone, two from xl */}
      <div className="form-table-layout">
        {/* إنشاء طلب جديد متاح لمن يملك صلاحية الإنشاء فقط - create form only for roles with create capability */}
        {canCreate && (
        <section className="form-panel app-card page-card" aria-labelledby="leave-form-title">
          <div className="page-card-header">
            <h2 id="leave-form-title" className="page-card-title">طلب إجازة جديد</h2>
          </div>
          <form onSubmit={submit} className="page-card-body">
            <div className="form-grid">
              <div>
                <label htmlFor="leave-employee-code" className="mb-1 block text-sm font-semibold text-[var(--text)]">
                  رمز الموظف <span className="muted text-xs">(EMP-001)</span>
                </label>
                <input
                  id="leave-employee-code"
                  placeholder="رمز الموظف (EMP-001)"
                  className="input"
                  value={form.employeeCode}
                  onChange={(event) => setForm({ ...form, employeeCode: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="leave-type" className="mb-1 block text-sm font-semibold text-[var(--text)]">
                  نوع الإجازة
                </label>
                <select
                  id="leave-type"
                  className="input"
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value })}
                >
                  <option value="annual">سنوية</option>
                  <option value="sick">مرضية</option>
                  <option value="emergency">طارئة</option>
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div>
                <label htmlFor="leave-start-date" className="mb-1 block text-sm font-semibold text-[var(--text)]">
                  من
                </label>
                <input
                  id="leave-start-date"
                  type="date"
                  className="input"
                  value={form.startDate}
                  onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="leave-end-date" className="mb-1 block text-sm font-semibold text-[var(--text)]">
                  إلى
                </label>
                <input
                  id="leave-end-date"
                  type="date"
                  className="input"
                  value={form.endDate}
                  onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                />
              </div>
            </div>

            <div>
              <label htmlFor="leave-reason" className="mb-1 block text-sm font-semibold text-[var(--text)]">
                السبب <span className="muted text-xs">(اختياري)</span>
              </label>
              <input
                id="leave-reason"
                placeholder="السبب (اختياري)"
                className="input"
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "جاري الإرسال..." : "إرسال الطلب"}
              </button>
            </div>

            {notice && (
              <div
                role={notice.kind === "error" ? "alert" : "status"}
                className={`mt-3 rounded-[var(--radius-md)] border bg-[var(--surface)] px-3 py-2 text-sm font-medium ${
                  notice.kind === "error"
                    ? "border-[var(--danger)] text-[var(--danger)]"
                    : "border-[var(--ok)] text-[var(--ok)]"
                }`}
              >
                {notice.text}
              </div>
            )}
          </form>
        </section>
        )}

        <section className={`table-panel app-card page-card${canCreate ? "" : " xl:col-span-2"}`} aria-labelledby="leave-table-title">
          <div className="page-card-header">
            <h2 id="leave-table-title" className="page-card-title">سجل الطلبات</h2>
            <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
              {leaves.length} طلب
            </span>
          </div>

          {/* تمرير مستقل للجدول: لا ينضغط النموذج ولا الأعمدة على الشاشات الضيقة
              Independent table scroll: neither the form nor the columns smush on narrow screens */}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">الموظف</th>
                  <th scope="col">النوع</th>
                  <th scope="col">من</th>
                  <th scope="col">إلى</th>
                  <th scope="col">الأيام</th>
                  <th scope="col">الحالة</th>
                  <th scope="col">التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => {
                  // رابط حقيقي لكل صف باستخدام معرّف الإجازة من API
                  // Every row links to its detail page using the real API id
                  const detailHref = `/leaves/${encodeURIComponent(leave.id)}`;
                  return (
                    <tr key={leave.id}>
                      <td>
                        <Link href={detailHref} className="font-semibold text-[var(--primary)] hover:underline">
                          {leave.employee?.name || "—"}
                        </Link>
                        <div className="text-[11px] muted">{leave.employee?.employeeCode || "—"}</div>
                      </td>
                      <td>{typeLabel[leave.type] || leave.type}</td>
                      <td>{leave.startDate.slice(0, 10)}</td>
                      <td>{leave.endDate.slice(0, 10)}</td>
                      <td>{leave.days}</td>
                      <td>
                        <span className={`status s-${leave.status}`}>
                          {statusLabel[leave.status] || leave.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={detailHref}
                          aria-label={`تفاصيل طلب الإجازة - ${leave.employee?.name || leave.id}`}
                          className="btn btn-ghost"
                        >
                          التفاصيل
                          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {loading && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center muted">جاري التحميل...</td>
                  </tr>
                )}
                {!loading && leaves.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center muted">لا توجد طلبات إجازة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
