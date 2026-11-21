"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/attendance", label: "الحضور والانصراف" },
  { href: "/employees", label: "الموظفون" },
  { href: "/leaves", label: "الإجازات" },
  { href: "/documents", label: "الوثائق" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  useEffect(() => { fetch("/api/auth/me").then(async r => { if(!r.ok){ router.replace("/"); return; } const d = await r.json(); setUser(d.user); }); }, [router]);
  async function logout(){ await fetch("/api/auth/logout",{method:"POST"}); router.replace("/"); }
  return (
    <div className="min-h-screen grid md:grid-cols-[260px_1fr]">
      <aside className="bg-[#123b70] text-white p-4 md:sticky md:top-0 md:h-screen">
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="w-11 h-11 rounded-xl bg-white/15 grid place-items-center font-bold">HR</div>
          <div><div className="font-bold">نظام الموارد البشرية</div><div className="text-xs text-white/70">University HRMS</div></div>
        </div>
        <nav className="space-y-1">
          {nav.map(i => <Link key={i.href} href={i.href} className={`block px-3 py-2.5 rounded-lg ${pathname===i.href?"bg-white/15":"hover:bg-white/10"}`}>{i.label}</Link>)}
        </nav>
        <div className="mt-6 p-3 rounded-lg bg-white/10 text-sm">
          <div className="font-semibold">{user?.name || "..."}</div>
          <div className="text-white/70">{user?.role}</div>
          <button onClick={logout} className="mt-2 text-xs underline text-white/90">تسجيل الخروج</button>
        </div>
      </aside>
      <main className="p-4 md:p-7">{children}</main>
    </div>
  );
}
