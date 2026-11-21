"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@hrms.local");
  const [password, setPassword] = useState("Admin@12345");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetch("/api/auth/me").then(r => { if (r.ok) router.replace("/dashboard"); }); }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "فشل تسجيل الدخول"); return; }
    router.replace("/dashboard");
  }

  async function seed() {
    setLoading(true); setError("");
    const res = await fetch("/api/seed", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setError(`تم تجهيز الحساب: ${data.user.email} / ${data.user.password}`);
    else setError("تعذر تجهيز البيانات");
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
          <div><label className="block text-sm font-semibold mb-1">البريد الإلكتروني</label><input className="w-full border border-slate-300 rounded-lg px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div><label className="block text-sm font-semibold mb-1">كلمة المرور</label><input type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2" value={password} onChange={e=>setPassword(e.target.value)} /></div>
          {error && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{error}</div>}
          <button disabled={loading} className="w-full bg-[#123b70] text-white rounded-lg py-2.5 font-semibold hover:bg-[#1d5a9a] disabled:opacity-60">{loading ? "..." : "دخول"}</button>
        </form>
        <button onClick={seed} className="w-full mt-3 border border-slate-300 rounded-lg py-2 text-sm hover:bg-slate-50">تجهيز بيانات أولية (Seed)</button>
      </div>
    </main>
  );
}
