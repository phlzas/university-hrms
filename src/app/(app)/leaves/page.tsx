"use client";
import { useEffect, useState } from "react";
export default function LeavesPage(){
  const [leaves,setLeaves]=useState<any[]>([]);
  const [form,setForm]=useState({employeeCode:"",type:"annual",startDate:"",endDate:"",reason:""});
  const [msg,setMsg]=useState("");
  async function load(){ const r=await fetch("/api/leaves"); const d=await r.json(); setLeaves(d.leaves||[]); }
  useEffect(()=>{load();},[]);
  async function submit(e:React.FormEvent){ e.preventDefault(); setMsg(""); const r=await fetch("/api/leaves",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}); const d=await r.json(); if(!r.ok){setMsg(d.error||"خطأ");return;} setMsg("تم إرسال الطلب"); setForm({employeeCode:"",type:"annual",startDate:"",endDate:"",reason:""}); load(); }
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold text-[#123b70]">الإجازات</h1><p className="text-slate-500">طلبات الإجازة ومتابعتها</p></div>
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <form onSubmit={submit} className="grid md:grid-cols-5 gap-2">
        <input placeholder="رقم الموظف" className="border rounded-lg px-3 py-2" value={form.employeeCode} onChange={e=>setForm({...form,employeeCode:e.target.value})} />
        <select className="border rounded-lg px-3 py-2" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="annual">سنوية</option><option value="sick">مرضية</option><option value="emergency">طارئة</option></select>
        <input type="date" className="border rounded-lg px-3 py-2" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} />
        <input type="date" className="border rounded-lg px-3 py-2" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})} />
        <button className="bg-[#123b70] text-white rounded-lg px-3 py-2">إضافة طلب</button>
      </form>
      {msg && <div className="text-sm text-slate-600">{msg}</div>}
      <div className="table-wrap"><table><thead><tr><th>الموظف</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th></tr></thead><tbody>
        {leaves.map(l=> <tr key={l.id}><td>{l.employee?.name} ({l.employee?.employeeCode})</td><td>{l.type}</td><td>{String(l.startDate).slice(0,10)}</td><td>{String(l.endDate).slice(0,10)}</td><td>{l.days}</td><td>{l.status}</td></tr>)}
        {leaves.length===0 && <tr><td colSpan={6} className="text-center text-slate-500 py-6">لا توجد طلبات</td></tr>}
      </tbody></table></div>
    </div></div>;
}
