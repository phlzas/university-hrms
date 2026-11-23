"use client";
// صفحة تسجيل الدخول - Login page (Arabic RTL)
// مسؤولياتها: seed أولي للتطوير، تسجيل الدخول، تحويل للوحة التحكم - handles dev seed, login, redirect to dashboard

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES, normalizeRole } from "@/lib/permissions";

// getErrorMessage() => استخراج رسالة خطأ مفهومة من رد API - extract readable API error message
function getErrorMessage(data: unknown, fallback: string) {
  if (typeof data !== "object" || data === null || !("error" in data)) return fallback;
  const error = data.error;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" && error.message) {
    return error.message;
  }
  return fallback;
}

function readRole(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("user" in data)) return null;
  const user = data.user;
  if (typeof user !== "object" || user === null || !("role" in user)) return null;
  return typeof user.role === "string" ? user.role : null;
}

function readSeedAccounts(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("users" in data)) return null;
  const users = data.users;
  if (typeof users !== "object" || users === null || !("superAdmin" in users)) return null;
  return typeof users.superAdmin === "string" && users.superAdmin ? users.superAdmin : null;
}

function destinationForRole(role: string | null): string {
  return normalizeRole(role) === ROLES.EMPLOYEE ? "/change-password" : "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();

  // حالة النموذج - form state
  const [email, setEmail] = useState("admin@hrms.local");
  const [password, setPassword] = useState("Admin@12345");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [canSeed, setCanSeed] = useState(false);

  // إذا كان المستخدم مسجل دخول بالفعل، حوّله للصفحة المناسبة - redirect authenticated users to their role destination
  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) return;
      const data: unknown = await r.json().catch(() => null);
      const role = readRole(data);
      setCanSeed(normalizeRole(role) === ROLES.HR_SUPER_ADMIN);
      router.replace(destinationForRole(role));
    });
  }, [router]);

  // onSubmit() => إرسال بيانات الدخول - submit login credentials
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(getErrorMessage(data, "فشل تسجيل الدخول - login failed"));
        return;
      }
      router.replace(destinationForRole(readRole(data)));
    } catch {
      // خطأ شبكة/اتصال - network/client error

      setError("تعذر الاتصال بالخادم - could not reach server");
    } finally {
      setLoading(false);
    }
  }

  // seed() => تهيئة بيانات تطوير سريعة - quick dev seed helper
  async function seed() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data: unknown = await res.json().catch(() => null);
      if (res.ok) setError(readSeedAccounts(data) ?? "تم تجهيز البيانات - seed verified");
      else setError(getErrorMessage(data, "تعذر تجهيز البيانات - seed failed"));
    } catch {
      setError("تعذر الاتصال بالخادم - could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#123b70] text-white font-bold text-xl mb-3">HR</div>
          <h1 className="text-2xl font-bold text-[#123b70]">تسجيل الدخول</h1>
          <p className="text-slate-500 mt-2">نظام إدارة الموارد البشرية</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">البريد الإلكتروني</label>
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">كلمة المرور</label>
            <input type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{error}</div>}
          <button disabled={loading} className="w-full bg-[#123b70] text-white rounded-lg py-2.5 font-semibold hover:bg-[#1d5a9a] disabled:opacity-60">
            {loading ? "..." : "دخول"}
          </button>
        </form>
        {canSeed && (
          <button onClick={seed} className="w-full mt-3 border border-slate-300 rounded-lg py-2 text-sm hover:bg-slate-50">
            تجهيز بيانات أولية (Seed)
          </button>
        )}
      </div>
    </main>

  );
}
