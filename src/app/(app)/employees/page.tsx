"use client";
// Employees page: add form + role-gated lifecycle table + provisioning dialog.

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/use-session";

type EmployeeRecord = {
  id: string; employeeCode: string; name: string; status: string;
  email?: string | null; department?: string | null; title?: string | null; deletedAt?: string | null;
};
type EmployeeForm = { employeeCode: string; name: string; email: string; department: string; title: string };
type EditForm = { name: string; department: string; title: string; email: string };
type Notice = { kind: "error" | "success"; text: string };
type ProvisionResult = { inviteUrl: string; expiresAt: string };

const EMPTY_FORM: EmployeeForm = { employeeCode: "", name: "", email: "", department: "", title: "" };
const EMPTY_EDIT: EditForm = { name: "", department: "", title: "", email: "" };
const ADD_FIELDS: { key: keyof EmployeeForm; label: string; hint: string; placeholder: string; testId: string }[] = [
  { key: "employeeCode", label: "رقم الموظف", hint: "(EMP-009)", placeholder: "مثال: EMP-009", testId: "employee-code" },
  { key: "name", label: "الاسم الكامل", hint: "*", placeholder: "الاسم الكامل", testId: "employee-name" },
  { key: "email", label: "البريد الإلكتروني", hint: "(اختياري)", placeholder: "name@example.com", testId: "employee-email" },
  { key: "department", label: "القسم", hint: "(اختياري)", placeholder: "مثال: الموارد البشرية", testId: "employee-department" },
  { key: "title", label: "المسمى الوظيفي", hint: "(اختياري)", placeholder: "مثال: أخصائي موارد بشرية", testId: "employee-title" },
];
const EDIT_FIELDS: { key: keyof EditForm; label: string }[] = [
  { key: "name", label: "الاسم الكامل" }, { key: "department", label: "القسم" },
  { key: "title", label: "المسمى الوظيفي" }, { key: "email", label: "البريد الإلكتروني" },
];
const statusLabel: Record<string, string> = { ACTIVE: "نشط", INACTIVE: "غير نشط", RENEWAL_DUE: "تجديد مستحق" };
const statusClass: Record<string, string> = { ACTIVE: "s-APPROVED", INACTIVE: "s-REJECTED", RENEWAL_DUE: "s-PENDING" };

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

function readEmployees(data: unknown): EmployeeRecord[] {
  if (typeof data !== "object" || data === null || !("employees" in data)) return [];
  const raw: unknown = data.employees;
  if (!Array.isArray(raw)) return [];
  const items: unknown[] = raw;
  return items.flatMap((item): EmployeeRecord[] => {
    if (typeof item !== "object" || item === null) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.name !== "string" || typeof row.status !== "string") return [];
    const email = typeof row.email === "string" ? row.email : null;
    if (typeof row.employeeId === "string") return [{ id: row.employeeId, employeeCode: row.employeeId, name: row.name, email, status: row.status }];
    if (typeof row.id !== "string" || typeof row.employeeCode !== "string") return [];
    return [{ id: row.id, employeeCode: row.employeeCode, name: row.name, email, status: row.status,
      department: typeof row.department === "string" ? row.department : null,
      title: typeof row.title === "string" ? row.title : null,
      deletedAt: typeof row.deletedAt === "string" ? row.deletedAt : null }];
  });
}

function Field({ id, label, hint, placeholder, value, onChange, testId, type, readOnly, required }: {
  id: string; label: string; hint?: string; placeholder?: string; value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; testId?: string; type?: string; readOnly?: boolean; required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-[var(--text)]">{label}{hint && <span className="muted text-xs"> {hint}</span>}</label>
      <input id={id} data-testid={testId} type={type ?? "text"} placeholder={placeholder} className="input min-h-11"
        value={value} onChange={onChange} readOnly={readOnly} required={required} onFocus={readOnly ? (e) => e.target.select() : undefined} />
    </div>
  );
}

function Dialog({ title, testId, onClose, children }: { title: string; testId: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input, button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} data-testid={testId} className="app-card page-card w-full max-w-md">
        <div className="page-card-header"><h2 className="page-card-title">{title}</h2></div>{children}
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const { role, canCreateEmployee, canUpdateEmployee, canDeleteEmployee, canRestoreEmployee, canProvisionAccount } = useSession();
  const isAdmin = role === "ADMIN";
  const showActions = !isAdmin && (canUpdateEmployee || canDeleteEmployee || canRestoreEmployee || canProvisionAccount);
  const colCount = isAdmin ? 4 : showActions ? 6 : 5;
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [provisioning, setProvisioning] = useState<EmployeeRecord | null>(null);
  const [provisionEmail, setProvisionEmail] = useState("");
  const [provisionResult, setProvisionResult] = useState<ProvisionResult | null>(null);

  async function api(url: string, init: RequestInit, fallback: string): Promise<unknown | null> {
    try {
      const response = await fetch(url, init);
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) { setNotice({ kind: "error", text: getErrorMessage(data, fallback) }); return null; }
      return data;
    } catch { setNotice({ kind: "error", text: "تعذر الاتصال بالخادم" }); return null; }
  }

  async function run(url: string, init: RequestInit, fallback: string, onSuccess: (d: unknown) => void) {
    setBusy(true);
    const data = await api(url, init, fallback);
    setBusy(false);
    if (data !== null) onSuccess(data);
  }

  async function load(withDeleted = false) {
    setLoading(true);
    const data = await api(withDeleted ? "/api/employees?includeDeleted=true" : "/api/employees", {}, "فشل تحميل الموظفين");
    if (data !== null) setEmployees(readEmployees(data));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openProvision(emp: EmployeeRecord) {
    setNotice(null); setProvisionEmail(emp.email ?? ""); setProvisionResult(null); setProvisioning(emp);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setNotice(null);
    if (!form.employeeCode.trim() || !form.name.trim()) { setNotice({ kind: "error", text: "رقم الموظف والاسم مطلوبان — employeeCode and name are required" }); return; }
    await run("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }, "فشل إضافة الموظف", () => {
      setNotice({ kind: "success", text: "تمت إضافة الموظف بنجاح" }); setForm(EMPTY_FORM); void load(includeDeleted);
    });
  }

  async function submitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!editing) return;
    await run(`/api/employees/${encodeURIComponent(editing.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) }, "فشل تعديل الموظف", () => {
      setNotice({ kind: "success", text: "تم تعديل الموظف بنجاح" }); setEditing(null); void load(includeDeleted);
    });
  }

  async function lifecycle(emp: EmployeeRecord, action: "terminate" | "restore") {
    if (action === "terminate" && !window.confirm(`تأكيد إنهاء الموظف ${emp.name}؟`)) return;
    const url = action === "terminate" ? `/api/employees/${encodeURIComponent(emp.id)}` : `/api/employees/${encodeURIComponent(emp.id)}/restore`;
    await run(url, { method: action === "terminate" ? "DELETE" : "POST" }, action === "terminate" ? "فشل إنهاء الموظف" : "فشل استعادة الموظف", () => {
      setNotice({ kind: "success", text: action === "terminate" ? "تم إنهاء الموظف" : "تمت استعادة الموظف" }); void load(includeDeleted);
    });
  }

  async function submitProvision(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!provisioning || !provisionEmail.trim()) return;
    await run("/api/accounts/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: provisioning.id, email: provisionEmail.trim() }) }, "فشل إنشاء الحساب", (d) => {
      const r = d as Record<string, unknown>;
      setProvisionResult({ inviteUrl: typeof r.inviteUrl === "string" ? r.inviteUrl : "", expiresAt: typeof r.expiresAt === "string" ? r.expiresAt : "" });
    });
  }

  return (
    <div className="space-y-5">
      <div><h1 className="page-title">الموظفون</h1><p className="page-sub">إدارة بيانات الموظفين والأقسام — Employee directory</p></div>
      {notice && <div role={notice.kind === "error" ? "alert" : "status"} data-testid="employee-notice"
        className={`rounded-[var(--radius-md)] border bg-[var(--surface)] px-3 py-2 text-sm font-medium ${notice.kind === "error" ? "border-[var(--danger)] text-[var(--danger)]" : "border-[var(--ok)] text-[var(--ok)]"}`}>{notice.text}</div>}
      <div className="form-table-layout">
        {canCreateEmployee && (
          <section className="form-panel app-card page-card" aria-labelledby="employee-form-title">
            <div className="page-card-header"><h2 id="employee-form-title" className="page-card-title">إضافة موظف</h2></div>
            <form onSubmit={submit} className="page-card-body" data-testid="employee-form">
              <div className="form-grid-2">
                {ADD_FIELDS.map((f) => <Field key={f.key} id={f.testId} testId={f.testId} label={f.label} hint={f.hint} placeholder={f.placeholder} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />)}
              </div>
              <div className="form-actions"><button type="submit" className="btn btn-primary min-h-11" disabled={busy} data-testid="add-employee">{busy ? "جاري الإضافة..." : "إضافة موظف"}</button></div>
            </form>
          </section>
        )}
        <section className={`table-panel app-card page-card${canCreateEmployee ? "" : " xl:col-span-2"}`} aria-labelledby="employee-table-title">
          <div className="page-card-header">
            <h2 id="employee-table-title" className="page-card-title">سجل الموظفين</h2>
            <div className="flex items-center gap-3">
              {canRestoreEmployee && <label className="flex items-center gap-2 text-sm muted"><input type="checkbox" data-testid="show-terminated" checked={includeDeleted} onChange={(e) => { setIncludeDeleted(e.target.checked); void load(e.target.checked); }} />إظهار المنهيين</label>}
              <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">{employees.length} موظف</span>
            </div>
          </div>
          <div className="table-scroll">
            <table data-testid="employees-table">
              <thead><tr><th scope="col">الرمز</th><th scope="col">الاسم</th>{isAdmin ? <th scope="col">البريد</th> : <><th scope="col">القسم</th><th scope="col">المسمى</th></>}<th scope="col">الحالة</th>{showActions && <th scope="col">إجراءات</th>}</tr></thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} data-testid="employee-row" data-employee-id={emp.id}>
                    <td className="font-mono text-xs muted">{emp.employeeCode}</td><td className="font-semibold text-[var(--text)]">{emp.name}</td>
                    {isAdmin ? <td>{emp.email || "—"}</td> : <><td>{emp.department || "—"}</td><td>{emp.title || "—"}</td></>}
                    <td><div className="flex flex-wrap items-center gap-2">
                      <span className={`status ${statusClass[emp.status] || "s-PENDING"}`}>{statusLabel[emp.status] || emp.status}</span>
                      {!isAdmin && emp.deletedAt && <span className="status s-LATE" data-testid="employee-deleted">محذوف</span>}
                      {isAdmin && canProvisionAccount && <button type="button" className="btn btn-ghost min-h-11" data-testid="provision-account" disabled={busy} onClick={() => openProvision(emp)}>إنشاء حساب</button>}
                    </div></td>
                    {showActions && <td><div className="flex flex-wrap items-center gap-2">
                      {canUpdateEmployee && !emp.deletedAt && <button type="button" className="btn btn-ghost min-h-11" data-testid="employee-edit" disabled={busy} onClick={() => { setNotice(null); setEditForm({ name: emp.name, department: emp.department ?? "", title: emp.title ?? "", email: emp.email ?? "" }); setEditing(emp); }}>تعديل</button>}
                      {canDeleteEmployee && !emp.deletedAt && <button type="button" className="btn btn-ghost min-h-11" data-testid="employee-terminate" disabled={busy} onClick={() => void lifecycle(emp, "terminate")}>إنهاء</button>}
                      {canRestoreEmployee && emp.deletedAt && <button type="button" className="btn btn-ghost min-h-11" data-testid="employee-restore" disabled={busy} onClick={() => void lifecycle(emp, "restore")}>استعادة</button>}
                      {canProvisionAccount && <button type="button" className="btn btn-ghost min-h-11" data-testid="provision-account" disabled={busy} onClick={() => openProvision(emp)}>إنشاء حساب</button>}
                    </div></td>}
                  </tr>
                ))}
                {loading && <tr><td colSpan={colCount} className="py-10 text-center muted">جاري التحميل...</td></tr>}
                {!loading && employees.length === 0 && <tr><td colSpan={colCount} className="py-10 text-center muted">لا يوجد موظفون</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {editing && (
        <Dialog title="تعديل الموظف" testId="employee-edit-dialog" onClose={() => setEditing(null)}>
          <form onSubmit={submitEdit} className="page-card-body" data-testid="employee-edit-form">
            {EDIT_FIELDS.map((f) => <Field key={f.key} id={`edit-${f.key}`} label={f.label} value={editForm[f.key]} onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })} />)}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary min-h-11" disabled={busy} data-testid="employee-edit-save">{busy ? "جاري الحفظ..." : "حفظ"}</button>
              <button type="button" className="btn btn-ghost min-h-11" onClick={() => setEditing(null)}>إلغاء</button>
            </div>
          </form>
        </Dialog>
      )}
      {provisioning && (
        <Dialog title="إنشاء حساب الموظف" testId="provision-dialog" onClose={() => setProvisioning(null)}>
          {provisionResult ? (
            <div className="page-card-body">
              <Field id="invite-url" testId="invite-url" label="رابط الدعوة" value={provisionResult.inviteUrl} readOnly />
              <p className="muted text-sm">تنتهي الصلاحية في: {provisionResult.expiresAt}</p>
              <div className="form-actions">
                <button type="button" className="btn btn-primary min-h-11" data-testid="copy-invite" onClick={() => { void navigator.clipboard?.writeText(provisionResult.inviteUrl); }}>نسخ الرابط</button>
                <button type="button" className="btn btn-ghost min-h-11" onClick={() => setProvisioning(null)}>إغلاق</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submitProvision} className="page-card-body" data-testid="provision-form">
              <Field id="provision-email" testId="provision-email" label="البريد الإلكتروني" type="email" required value={provisionEmail} onChange={(e) => setProvisionEmail(e.target.value)} />
              <div className="form-actions">
                <button type="submit" className="btn btn-primary min-h-11" disabled={busy || !provisionEmail.trim()} data-testid="provision-submit">{busy ? "جاري الإنشاء..." : "إنشاء حساب"}</button>
                <button type="button" className="btn btn-ghost min-h-11" onClick={() => setProvisioning(null)}>إلغاء</button>
              </div>
            </form>
          )}
        </Dialog>
      )}
    </div>
  );
}
