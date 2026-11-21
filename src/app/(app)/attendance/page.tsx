"use client";
import { useEffect, useState } from "react";

export default function AttendancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [q, setQ] = useState(""); const [date, setDate] = useState(""); const [status, setStatus] = useState("");
  const [msg, setMsg] = useState(""); const [file, setFile] = useState<File|null>(null);
  async function load(){ const params = new URLSearchParams(); if(q) params.set("q",q); if(date) params.set("date",date); if(status) params.set("status",status);
    const r = await fetch(`/api/attendance?${params.toString()}`); const d = await r.json(); setRecords(d.records||[]); }
  useEffect(()=>{ load(); }, []);

  async function importFile(e:React.FormEvent){ e.preventDefault(); if(!file) return; setMsg("جارٍ الاستيراد...");
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/attendance/import", { method:"POST", body: fd }); const d = await r.json();
    setMsg(r.ok ? `تم استيراد ${d.imported} سجل` : (d.error || "فشل")); setFile(null); load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap"><div><h1 className="text-2xl font-bold text-[#123b70]">الحضور والانصراف</h1><p className="text-slate-500">استيراد وعرض سجلات الحضور</p></div></div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <form onSubmit={importFile} className="flex gap-2 flex-wrap items-center">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={e=>setFile(e.target.files?.[0]||null)} className="text-sm" />
          <button className="bg-[#123b70] text-white px-4 py-2 rounded-lg text-sm">استيراد ملف</button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </form>
        <div className="grid md:grid-cols-4 gap-2">
          <input placeholder="بحث بالاسم/الرقم" className="border rounded-lg px-3 py-2" value={q} onChange={e=>setQ(e.target.value)} />
          <input type="date" className="border rounded-lg px-3 py-2" value={date} onChange={e=>setDate(e.target.value)} />
          <select className="border rounded-lg px-3 py-2" value={status} onChange={e=>setStatus(e.target.value)}><option value="">كل الحالات</option><option value="PRESENT">حاضر</option><option value="GRACE">فترة سماح</option><option value="LATE">متأخر</option><option value="INCOMPLETE">غير مكتمل</option><option value="ABSENT">غائب</option></select>
          <button onClick={load} className="border rounded-lg px-3 py-2 hover:bg-slate-50">تطبيق</button>
        </div>
        <div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>رقم الموظف</th><th>الاسم</th><th>القسم</th><th>دخول</th><th>خروج</th><th>الحالة</th><th>تأخير(د)</th><th>المصدر</th></tr></thead><tbody>
          {records.map(r=> <tr key={r.id}><td>{String(r.date).slice(0,10)}</td><td>{r.employee?.employeeCode}</td><td>{r.employee?.name}</td><td>{r.employee?.department||"-"}</td><td>{r.checkIn||"-"}</td><td>{r.checkOut||"-"}</td><td><span className={`status s-${r.status}`}>{label(r.status)}</span></td><td>{r.minutesLate||"-"}</td><td>{r.source}</td></tr>)}
          {records.length===0 && <tr><td colSpan={9} className="text-center text-slate-500 py-6">لا توجد سجلات</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  );
}
function label(s:string){ return ({PRESENT:"حاضر",GRACE:"فترة سماح",LATE:"متأخر",ABSENT:"غائب",INCOMPLETE:"غير مكتمل",LEAVE:"إجازة"} as any)[s] || s; }
