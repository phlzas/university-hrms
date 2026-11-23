"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, type FormEvent } from "react";

type ApiError = { code?: string; message?: string };
type ApiResponse = { ok?: boolean; error?: ApiError | string } & Record<string, unknown>;

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: "يرجى إدخال كلمة المرور.",
  WEAK_PASSWORD: "كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.",
  INVALID_OR_EXPIRED_TOKEN: "رابط الدعوة غير صالح أو منتهي الصلاحية.",
  ACCOUNT_BLOCKED: "تم إيقاف هذا الحساب. تواصل مع الإدارة.",
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

function InviteForm() {
  const searchParams = useSearchParams();
  const tokenRef = useRef(searchParams.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setDone(false);
    if (!tokenRef.current) {
      setError(ERROR_MESSAGES.INVALID_OR_EXPIRED_TOKEN);
      return;
    }
    if (!password) {
      setError(ERROR_MESSAGES.MISSING_FIELDS);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenRef.current, password }),
      });
      const data: unknown = await response.json().catch(() => null);
      const root = asRecord(data) as ApiResponse | null;
      if (!response.ok || root?.ok !== true) {
        throw new Error(getErrorMessage(data, "تعذّر تفعيل الدعوة. حاول مرة أخرى."));
      }
      tokenRef.current = "";
      setPassword("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تفعيل الدعوة. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-4 md:p-7 lg:p-8 min-w-0">
      <div className="page-card">
        <div className="page-card-header">
          <h1 className="page-title">تفعيل الدعوة</h1>
          <p className="page-sub">أدخل كلمة المرور لتفعيل حسابك.</p>
        </div>
        <div className="page-card-body">
          {error && <div className="status s-REJECTED" role="alert" data-testid="invite-error">{error}</div>}
          {done && (
            <div className="status s-APPROVED" role="status" data-testid="invite-success">
              تم تفعيل الحساب بنجاح. <Link href="/" className="btn btn-ghost">تسجيل الدخول</Link>
            </div>
          )}
          {!done && (
            <form onSubmit={submit} data-testid="invite-form">
              <div>
                <label htmlFor="invite-password">كلمة المرور</label>
                <input
                  id="invite-password"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  data-testid="invite-password"
                />
                <p className="muted">8 أحرف على الأقل.</p>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={busy || !tokenRef.current} data-testid="invite-submit">
                  {busy ? "جارٍ التفعيل..." : "تفعيل الحساب"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<main className="p-4 md:p-7 lg:p-8 min-w-0"><div className="page-card"><div className="page-card-body muted">جارٍ تحميل الدعوة...</div></div></main>}>
      <InviteForm />
    </Suspense>
  );
}
