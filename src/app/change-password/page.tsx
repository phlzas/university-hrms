"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type ApiError = { code?: string; message?: string };
type ApiResponse = { ok?: boolean; error?: ApiError | string } & Record<string, unknown>;

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.",
  INVALID_CURRENT_PASSWORD: "كلمة المرور الحالية غير صحيحة.",
  WEAK_PASSWORD: "كلمة المرور الجديدة ضعيفة. استخدم 8 أحرف على الأقل.",
  INTERNAL_ERROR: "حدث خطأ في الخادم. حاول مرة أخرى.",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function getErrorMessage(data: unknown, fallback: string): string {
  const root = asRecord(data);
  if (!root) return fallback;
  const err = root.error;
  if (typeof err === "string" && err.trim()) return err;
  const errObj = asRecord(err);
  if (!errObj) return fallback;
  const message = errObj.message;
  if (typeof message === "string" && message.trim()) return message;
  const code = errObj.code;
  if (typeof code === "string") return ERROR_MESSAGES[code] ?? fallback;
  return fallback;
}

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setDone(false);
    if (!currentPassword || !newPassword) {
      setError("يرجى إدخال كلمة المرور الحالية والجديدة.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data: unknown = await response.json().catch(() => null);
      const root = asRecord(data) as ApiResponse | null;
      if (!response.ok || root?.ok !== true) {
        throw new Error(getErrorMessage(data, "تعذّر تغيير كلمة المرور. حاول مرة أخرى."));
      }
      setCurrentPassword("");
      setNewPassword("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تغيير كلمة المرور. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-4 md:p-7 lg:p-8 min-w-0">
      <div className="page-card">
        <div className="page-card-header">
          <h1 className="page-title">تغيير كلمة المرور</h1>
          <p className="page-sub">يتم تغيير كلمة مرور حسابك الحالي فقط.</p>
        </div>
        <div className="page-card-body">
          {error && <div className="status s-REJECTED" role="alert" data-testid="password-error">{error}</div>}
          {done && (
            <div className="status s-APPROVED" role="status" data-testid="password-success">
              تم تغيير كلمة المرور بنجاح. <Link href="/dashboard" className="btn btn-ghost">العودة للوحة التحكم</Link>
            </div>
          )}
          {!done && (
            <form onSubmit={submit} data-testid="password-form">
              <div>
                <label htmlFor="current-password">كلمة المرور الحالية</label>
                <input
                  id="current-password"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  data-testid="current-password"
                />
              </div>
              <div>
                <label htmlFor="new-password">كلمة المرور الجديدة</label>
                <input
                  id="new-password"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  minLength={8}
                  data-testid="new-password"
                />
                <p className="muted">8 أحرف على الأقل.</p>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={busy} data-testid="password-submit">
                  {busy ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
