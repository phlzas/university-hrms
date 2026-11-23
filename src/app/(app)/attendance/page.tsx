"use client";
// صفحة الحضور: فلاتر + استيراد + إضافة يدوية بمنتقي موظفين قابل للبحث + روابط التفاصيل
// Attendance page: filters, import, searchable manual entry, and per-row detail links

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/use-session";

type EmployeeOption = {
  id: string;
  employeeCode: string;
  name: string;
  department?: string | null;
};

type AttendanceRecord = {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  minutesLate: number | null;
  source: string;
  employee?: { name: string; employeeCode: string; department?: string | null } | null;
};

const statusLabel: Record<string, string> = {
  PRESENT: "حاضر",
  GRACE: "سماح",
  LATE: "متأخر",
  ABSENT: "غائب",
  INCOMPLETE: "غير مكتمل",
  LEAVE: "إجازة",
};

// استخراج رسالة الخطأ الموحّدة من استجابة API - unified error extraction from API responses
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

// تاريخ اليوم بالمنطقة الزمنية المحلية بصيغة YYYY-MM-DD - local today (not UTC) for the date default
function todayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// تحقق خفيف من صيغة الوقت قبل الإرسال - lightweight HH:MM validation before POST
function isValidTime(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export default function AttendancePage() {
  const { canCreate, canImport, canUpdate } = useSession();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);

  // حالة الإضافة اليدوية ومنتقي الموظفين - manual entry + employee typeahead state
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [employeeLoadError, setEmployeeLoadError] = useState("");
  const [form, setForm] = useState({ date: todayLocal(), checkIn: "", checkOut: "", notes: "" });
  const [formError, setFormError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // تحميل السجلات مع فلاتر اختيارية (تُستخدم لإعادة التحميل بعد الحفظ) - load records with optional filter overrides
  async function load(overrides?: { q?: string; date?: string; status?: string }) {
    setLoading(true);
    setMsg("");
    const activeQ = overrides?.q ?? q;
    const activeDate = overrides?.date ?? date;
    const activeStatus = overrides?.status ?? status;
    try {
      const params = new URLSearchParams();
      if (activeQ) params.set("q", activeQ);
      if (activeDate) params.set("date", activeDate);
      if (activeStatus) params.set("status", activeStatus);
      const r = await fetch(`/api/attendance?${params.toString()}`);
      const d: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setMsg(getErrorMessage(d, "فشل تحميل السجلات"));
        setRecords([]);
        return;
      }
      const list = d && typeof d === "object" && Array.isArray((d as Record<string, unknown>).records)
        ? (d as { records: AttendanceRecord[] }).records
        : [];
      setRecords(list);
    } catch {
      setMsg("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  // جلب الموظفين مرة واحدة لتغذية البحث المحلي - fetch employees once to back the local typeahead
  async function loadEmployees() {
    try {
      const r = await fetch("/api/employees");
      const d: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setEmployeeLoadError(getErrorMessage(d, "تعذر تحميل قائمة الموظفين"));
        return;
      }
      const list = d && typeof d === "object" && Array.isArray((d as Record<string, unknown>).employees)
        ? (d as { employees: EmployeeOption[] }).employees
        : [];
      setEmployees(list);
      setEmployeeLoadError("");
    } catch {
      setEmployeeLoadError("تعذر الاتصال بالخادم أثناء تحميل الموظفين");
    }
  }

  useEffect(() => {
    load();
    loadEmployees();
  }, []);

  // مطابقة الاسم أو الرمز مع دعم العربية وحروف اللاتينية - match name or code, Arabic and Latin alike
  const matches = useMemo(() => {
    const needle = employeeQuery.trim().toLocaleLowerCase();
    const pool = needle
      ? employees.filter((emp) =>
          emp.name.toLocaleLowerCase().includes(needle) ||
          emp.employeeCode.toLocaleLowerCase().includes(needle))
      : employees;
    return pool.slice(0, 8);
  }, [employees, employeeQuery]);

  // اختيار موظف يحفظ المعرّف والرمز معاً - selecting a match stores both id and employeeCode
  function selectEmployee(emp: EmployeeOption) {
    setSelectedEmployee(emp);
    setEmployeeQuery(emp.name);
    setPickerOpen(false);
    setActiveIndex(0);
    setFormError("");
  }

  function onPickerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPickerOpen(true);
      if (matches.length) setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && pickerOpen && matches.length > 0) {
      e.preventDefault();
      selectEmployee(matches[activeIndex] ?? matches[0]);
    } else if (e.key === "Escape") {
      setPickerOpen(false);
    }
  }

  function resetForm() {
    setSelectedEmployee(null);
    setEmployeeQuery("");
    setPickerOpen(false);
    setActiveIndex(0);
    setForm({ date: todayLocal(), checkIn: "", checkOut: "", notes: "" });
    setFormError("");
    setSaveMsg("");
  }

  // الإرسال اليدوي: التحقق ثم POST بالصيغة التي يتوقعها API (employeeCode) - validate then POST with the exact API payload
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    setSaveMsg("");
    if (!selectedEmployee) {
      setFormError("يرجى اختيار الموظف من قائمة البحث — Please select an employee from the search list");
      return;
    }
    if (!form.date) {
      setFormError("التاريخ مطلوب — Date is required");
      return;
    }
    if (!isValidTime(form.checkIn) || !isValidTime(form.checkOut)) {
      setFormError("يرجى إدخال وقت دخول وخروج صالحين — Enter valid check-in and check-out times");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employeeCode: selectedEmployee.employeeCode,
        date: form.date,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        notes: form.notes.trim(),
      };
      const r = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setFormError(getErrorMessage(d, "فشل حفظ السجل — Failed to save the record"));
        return;
      }
      setSaveMsg("تمت إضافة سجل الحضور بنجاح — Attendance record added");
      resetForm();
      setSaveMsg("تمت إضافة سجل الحضور بنجاح — Attendance record added");
      // إزالة الفلاتر لضمان ظهور السجل الجديد في الجدول - clear filters so the new row is guaranteed visible
      setQ("");
      setDate("");
      setStatus("");
      await load({ q: "", date: "", status: "" });
    } catch {
      setFormError("تعذر الاتصال بالخادم — Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function importFile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setMsg("جاري الاستيراد...");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/attendance/import", { method: "POST", body: fd });
      const d: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setMsg(getErrorMessage(d, "فشل الاستيراد"));
        return;
      }
      const imported = d && typeof d === "object" && typeof (d as Record<string, unknown>).imported === "number"
        ? (d as { imported: number }).imported
        : 0;
      setMsg(`تم استيراد ${imported} سجل`);
      setFile(null);
      await load();
    } catch {
      setMsg("تعذر الاتصال بالخادم");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">الحضور والانصراف</h1>
        <p className="page-sub">متابعة السجلات، الفلترة، الاستيراد، والإضافة اليدوية</p>
      </div>

      <section className="app-card page-card">
        <div className="page-card-header">
          <h2 className="page-card-title">{canImport ? "الفلاتر والاستيراد" : "الفلاتر"}</h2>
          {msg && <p role="status" className="text-sm muted">{msg}</p>}
        </div>
        {/* الاستيراد عملية تحديث: مخفي عن الأدمن والمشاهد - import is update-style: hidden from ADMIN/VIEWER */}
        {canImport && (
        <form onSubmit={importFile} className="form-actions">
          <label className="btn btn-ghost cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <span>{file ? file.name : "اختيار ملف حضور"}</span>
          </label>
          <button type="submit" className="btn btn-primary" disabled={!file}>استيراد</button>
        </form>
        )}
        <div className="form-grid" style={{ marginBlockStart: "var(--space-3)" }}>
          <input
            placeholder="بحث بالاسم/الرمز"
            aria-label="بحث بالاسم أو الرمز"
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <input
            type="date"
            aria-label="تاريخ الفلتر"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <select
            aria-label="حالة الفلتر"
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">كل الحالات</option>
            {Object.keys(statusLabel).map((key) => (
              <option key={key} value={key}>{statusLabel[key]}</option>
            ))}
          </select>
          <button type="button" onClick={() => load()} className="btn btn-ghost">تطبيق الفلتر</button>
        </div>
      </section>

      <div className="form-table-layout">
        {/* نموذج الإضافة اليدوية - manual add form (create capability only) */}
        {canCreate && (
        <section className="form-panel app-card page-card">
          <div className="page-card-header">
            <h2 className="page-card-title">إضافة سجل يدوي</h2>
          </div>
          <form onSubmit={submit} className="page-card-body" noValidate data-testid="manual-attendance-form">
            <div>
              <label htmlFor="employee-picker" className="text-sm font-semibold">
                الموظف <span className="muted">(بالاسم أو الرمز)</span>
              </label>
              <div className="relative" style={{ marginBlockStart: "var(--space-1)" }}>
                <input
                  id="employee-picker"
                  data-testid="employee-picker"
                  data-employee-id={selectedEmployee?.id ?? ""}
                  className="input"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  aria-controls="employee-options"
                  aria-autocomplete="list"
                  aria-activedescendant={pickerOpen && matches.length ? `employee-option-${activeIndex}` : undefined}
                  autoComplete="off"
                  placeholder="ابحث باسم الموظف أو رمزه..."
                  value={employeeQuery}
                  onChange={(e) => {
                    setEmployeeQuery(e.target.value);
                    setSelectedEmployee(null);
                    setPickerOpen(true);
                    setActiveIndex(0);
                    setFormError("");
                  }}
                  onFocus={() => setPickerOpen(true)}
                  onBlur={() => setPickerOpen(false)}
                  onKeyDown={onPickerKeyDown}
                />
                {pickerOpen && (
                  <ul
                    id="employee-options"
                    role="listbox"
                    aria-label="نتائج البحث عن الموظفين"
                    className="absolute inset-x-0 z-20 mt-1 max-h-60 overflow-auto border bg-[var(--surface)] shadow-lg"
                    style={{ borderColor: "var(--border)", borderRadius: "var(--radius-md)" }}
                  >
                    {matches.length === 0 && (
                      <li className="px-3 py-2 text-sm muted">لا يوجد موظف مطابق — No matching employee</li>
                    )}
                    {matches.map((emp, index) => (
                      <li
                        key={emp.id}
                        id={`employee-option-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                      >
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectEmployee(emp)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-[var(--surface-alt)]"
                        >
                          <span className="font-semibold">{emp.name}</span>
                          <span className="text-xs muted">
                            {emp.employeeCode}{emp.department ? ` · ${emp.department}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {selectedEmployee && (
                <p className="text-xs muted" style={{ marginBlockStart: "var(--space-1)" }}>
                  الموظف المحدد: {selectedEmployee.name} — {selectedEmployee.employeeCode}
                </p>
              )}
              {employeeLoadError && (
                <p role="alert" className="text-sm text-[var(--danger)]" style={{ marginBlockStart: "var(--space-1)" }}>
                  {employeeLoadError}
                </p>
              )}
            </div>

            <div className="form-grid-2">
              <div>
                <label htmlFor="entry-date" className="text-sm font-semibold">التاريخ</label>
                <input
                  id="entry-date"
                  data-testid="entry-date"
                  type="date"
                  className="input"
                  style={{ marginBlockStart: "var(--space-1)" }}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="check-in" className="text-sm font-semibold">وقت الدخول</label>
                <input
                  id="check-in"
                  data-testid="check-in"
                  type="time"
                  className="input"
                  style={{ marginBlockStart: "var(--space-1)" }}
                  value={form.checkIn}
                  onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div>
                <label htmlFor="check-out" className="text-sm font-semibold">وقت الخروج</label>
                <input
                  id="check-out"
                  data-testid="check-out"
                  type="time"
                  className="input"
                  style={{ marginBlockStart: "var(--space-1)" }}
                  value={form.checkOut}
                  onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="entry-notes" className="text-sm font-semibold">ملاحظات (اختياري)</label>
                <input
                  id="entry-notes"
                  className="input"
                  style={{ marginBlockStart: "var(--space-1)" }}
                  placeholder="ملاحظة اختيارية"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            {formError && (
              <p role="alert" data-testid="form-error" className="text-sm font-semibold text-[var(--danger)]">
                {formError}
              </p>
            )}
            {saveMsg && (
              <p role="status" data-testid="save-message" className="text-sm font-semibold text-[var(--ok)]">
                {saveMsg}
              </p>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving} data-testid="save-attendance">
                {saving ? "جاري الحفظ..." : "حفظ السجل"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={resetForm}>إعادة تعيين</button>
            </div>
          </form>
        </section>
        )}

        {/* جدول السجلات مع رابط لكل سجل - records table with a real-id detail link per row */}
        <section className={`table-panel app-card page-card${canCreate ? "" : " xl:col-span-2"}`}>
          <div className="page-card-header">
            <h2 className="page-card-title">سجلات الحضور</h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{records.length} سجل</span>
          </div>
          <div className="table-scroll">
            <table data-testid="attendance-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الموظف</th>
                  <th>القسم</th>
                  <th>دخول</th>
                  <th>خروج</th>
                  <th>الحالة</th>
                  <th>تأخير(د)</th>
                  <th>المصدر</th>
                  <th>التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} data-testid="attendance-row" data-record-id={r.id}>
                    <td className="muted">{String(r.date).slice(0, 10)}</td>
                    <td>
                      <Link
                        href={`/attendance/${r.id}`}
                        className="font-semibold text-[var(--primary-2)] hover:underline"
                      >
                        {r.employee?.name || "-"}
                      </Link>
                      <div className="text-xs muted">{r.employee?.employeeCode}</div>
                    </td>
                    <td>{r.employee?.department || "-"}</td>
                    <td>{r.checkIn || "-"}</td>
                    <td>{r.checkOut || "-"}</td>
                    <td><span className={`status s-${r.status}`}>{statusLabel[r.status] || r.status}</span></td>
                    <td>{r.minutesLate ?? "-"}</td>
                    <td className="text-xs muted">{r.source}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1">
                        <Link
                          href={`/attendance/${r.id}`}
                          className="btn btn-ghost"
                          style={{ padding: "var(--space-1) var(--space-2)" }}
                        >
                          عرض
                        </Link>
                        {/* رابط التعديل يظهر لأصحاب صلاحية التحديث فقط - edit affordance only for update-capable roles */}
                        {canUpdate && (
                          <Link
                            href={`/attendance/${r.id}`}
                            className="btn btn-ghost"
                            style={{ padding: "var(--space-1) var(--space-2)" }}
                          >
                            تعديل
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && <tr><td colSpan={9} className="py-10 text-center muted">جاري التحميل...</td></tr>}
                {!loading && records.length === 0 && (
                  <tr><td colSpan={9} className="py-10 text-center muted">لا توجد سجلات مطابقة</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
