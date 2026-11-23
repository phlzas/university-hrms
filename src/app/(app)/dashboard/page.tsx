"use client";
// لوحة التحكم - Dashboard page with meaningful seeded data and modern UI

import { useEffect, useState } from "react";
function getErrorMessage(data: any, fallback: string) { if (!data) return fallback; if (typeof data.error === 'string') return data.error; if (data.error?.message) return data.error.message; return fallback; }
const statusLabel: any = { PRESENT:'حاضر', GRACE:'سماح', LATE:'متأخر', ABSENT:'غائب', INCOMPLETE:'غير مكتمل', LEAVE:'إجازة', PENDING:'قيد المراجعة', APPROVED:'مقبول', REJECTED:'مرفوض' };

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/dashboard').then(async (r) => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(getErrorMessage(d, 'فشل تحميل اللوحة - dashboard load failed')); setData(d); }).catch((e) => setErr(e.message || 'فشل التحميل')); }, []);
  const s = data?.stats;

  return <div className="space-y-6">
    <section className="app-card p-5 md:p-6 text-white border-0 overflow-hidden relative" style={{ backgroundImage: "linear-gradient(135deg,#0b2b52 0%,#123b70 55%,#174d86 100%)" }}>
      <div aria-hidden="true" className="absolute inset-0 opacity-25 pointer-events-none" style={{backgroundImage:'radial-gradient(circle at 6% 12%, rgba(56,132,214,.45) 0, transparent 30%), radial-gradient(circle at 12% 92%, rgba(37,110,190,.35) 0, transparent 24%)'}} />
      <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div><div className="text-white/70 text-sm mb-1">جامعة / University HRMS</div><h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">لوحة تحكم الموارد البشرية</h1><p className="text-white/80 text-sm mt-2 max-w-2xl">نظرة سريعة على الحضور، الإجازات، والملفات — مع بيانات تجريبية جاهزة للعرض. Quick operational overview.</p></div>
        <div className="flex gap-2 text-xs"><span className="px-3 py-1.5 rounded-full bg-white/15 border border-white/25">تحديث مباشر</span><span className="px-3 py-1.5 rounded-full bg-emerald-500/25 text-emerald-50 border border-emerald-300/30">النظام يعمل</span></div>
      </div>
    </section>

    {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{err}</div>}

    <section className="grid grid-cols-2 xl:grid-cols-6 gap-3 md:gap-4">
      <Stat label="الموظفون" value={s?.employees} icon="users" />
      <Stat label="حاضر اليوم" value={s?.presentToday} icon="check" tone="green" />
      <Stat label="متأخرون" value={s?.lateToday} icon="clock" tone="red" />
      <Stat label="سماح" value={s?.graceToday} icon="clock" tone="amber" />
      <Stat label="غير مكتمل" value={s?.incompleteToday} icon="alert" tone="blue" />
      <Stat label="طلبات معلقة" value={s?.pendingLeaves} icon="calendar" tone="violet" />
    </section>

    <section className="grid xl:grid-cols-3 gap-4 md:gap-5">
      <div className="xl:col-span-2 app-card p-4 md:p-5">
        <div className="flex items-center justify-between mb-4"><div><h2 className="font-bold text-[#123b70] text-lg">آخر سجلات الحضور</h2><p className="text-xs muted">آخر النشاطات المسجلة في النظام</p></div><span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{data?.recentAttendance?.length || 0} سجلات</span></div>
        <div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>الموظف</th><th>القسم</th><th>دخول</th><th>خروج</th><th>الحالة</th></tr></thead><tbody>
          {(data?.recentAttendance || []).map((r: any) => <tr key={r.id}><td className="text-slate-600">{String(r.date).slice(0,10)}</td><td><div className="font-medium text-slate-800">{r.employee?.name}</div><div className="text-[11px] muted">{r.employee?.employeeCode}</div></td><td className="text-slate-600">{r.employee?.department||'-'}</td><td>{r.checkIn||'-'}</td><td>{r.checkOut||'-'}</td><td><span className={`status s-${r.status}`}>{statusLabel[r.status]||r.status}</span></td></tr>)}
          {!data && !err && <tr><td colSpan={6} className="py-10 text-center muted">جاري التحميل...</td></tr>}
          {data && !data.recentAttendance?.length && <tr><td colSpan={6} className="py-10 text-center muted">لا توجد سجلات حضور بعد</td></tr>}
        </tbody></table></div>
      </div>

      <div className="app-card p-4 md:p-5">
        <div className="flex items-center justify-between mb-4"><div><h2 className="font-bold text-[#123b70] text-lg">طلبات الإجازة</h2><p className="text-xs muted">آخر الطلبات والحالات</p></div><span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">{s?.pendingLeaves ?? '-'} معلقة</span></div>
        <div className="space-y-3">
          {(data?.recentLeaves || []).map((l: any) => <div key={l.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
            <div className="flex items-start justify-between gap-2"><div><div className="font-medium text-sm text-slate-800">{l.employee?.name}</div><div className="text-[11px] muted">{l.type} • {String(l.startDate).slice(0,10)}</div></div><span className={`status s-${l.status}`}>{statusLabel[l.status]||l.status}</span></div>
          </div>)}
          {data && !data.recentLeaves?.length && <div className="py-8 text-center muted text-sm">لا توجد طلبات إجازة</div>}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm"><span className="muted">الملفات في النظام</span><span className="font-bold text-[#123b70]">{s?.files ?? '-'}</span></div>
      </div>
    </section>
  </div>;
}

function Stat({ label, value, tone, icon }: any) {
  const tones: any = { green:'text-emerald-600 bg-emerald-50', red:'text-red-600 bg-red-50', amber:'text-amber-600 bg-amber-50', blue:'text-blue-600 bg-blue-50', violet:'text-violet-600 bg-violet-50' };
  const t = tones[tone] || 'text-[#123b70] bg-slate-100';
  const icons: any = { users:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', check:'M5 13l4 4L19 7', clock:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', alert:'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', calendar:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' };
  return <div className="app-card app-card-hover p-4"><div className="flex items-start justify-between gap-3"><div><div className={`text-2xl font-extrabold ${t.split(' ')[0]}`}>{value ?? '—'}</div><div className="text-sm muted mt-1">{label}</div></div><div className={`w-9 h-9 rounded-xl grid place-items-center ${t}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={icons[icon] || icons.check}/></svg></div></div></div>;
}