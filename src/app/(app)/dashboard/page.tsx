"use client";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch("/api/dashboard").then(r=>r.json()).then(setData); }, []);
  const s = data?.stats;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-[#123b70]">لوحة التحكم</h1><p className="text-slate-500">نظرة عامة على الحضور والموارد البشرية</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card label="الموظفون" value={s?.employees} />
        <Card label="حضور اليوم" value={s?.presentToday} />
        <Card label="متأخرون" value={s?.lateToday} tone="red" />
        <Card label="فترة سماح" value={s?.graceToday} tone="amber" />
        <Card label="غير مكتمل" value={s?.incompleteToday} tone="blue" />
        <Card label="طلبات إجازة معلقة" value={s?.pendingLeaves} />
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="font-bold text-[#123b70] mb-3">آخر سجلات الحضور</h2>
        <div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>الرقم</th><th>الاسم</th><th>القسم</th><th>دخول</th><th>خروج</th><th>الحالة</th></tr></thead><tbody>
          {(data?.recentAttendance||[]).map((r:any)=> <tr key={r.id}><td>{String(r.date).slice(0,10)}</td><td>{r.employee?.employeeCode}</td><td>{r.employee?.name}</td><td>{r.employee?.department||"-"}</td><td>{r.checkIn||"-"}</td><td>{r.checkOut||"-"}</td><td><span className={`status s-${r.status}`}>{label(r.status)}</span></td></tr>)}
          {!data && <tr><td colSpan={7}>جارٍ التحميل...</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  );
}
function Card({label,value,tone}:{label:string;value:any;tone?:string}){ const c = tone==="red"?"text-red-600":tone==="amber"?"text-amber-600":tone==="blue"?"text-blue-600":"text-[#123b70]"; return <div className="bg-white border border-slate-200 rounded-xl p-4"><div className={`text-2xl font-bold ${c}`}>{value ?? "-"}</div><div className="text-sm text-slate-500 mt-1">{label}</div></div>; }
function label(s:string){ return ({PRESENT:"حاضر",GRACE:"فترة سماح",LATE:"متأخر",ABSENT:"غائب",INCOMPLETE:"غير مكتمل",LEAVE:"إجازة"} as any)[s] || s; }
