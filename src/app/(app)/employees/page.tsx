"use client";
import { useEffect, useState } from "react";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState({ employeeCode:"", name:"", department:"", title:"" });
  const [msg, setMsg] = useState("");
  async function load(){ const r = await fetch("/api/employees"); const d = await r.json(); setEmployees(d.employees||[]); }
  useEffect(()=>{ load(); }, []);
  async function add(e:React.FormEvent){ e.preventDefault(); setMsg(""); const r = await fetch("/api/employees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}); const d=await r.json(); if(!r.ok){setMsg(d.error||"خطأ"); return;} setForm({employeeCode:"",name:"",department:"",title:""}); setMsg("تمت الإضافة"); load(); }
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-[#123b70]">الموظفون</h1><p className="text-slate-500">إدارة بيانات الموظفين</p></div>
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <form onSubmit={add} className="grid md:grid-cols-5 gap-2 mb-4">
          <input placeholder="رقم الموظف" className="border rounded-lg px-3 py-2" value={form.employeeCode} onChange={e=>setForm({...form,employeeCode:e.target.value})} />
          <input placeholder="الاسم" className="border rounded-lg px-3 py-2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
          <input placeholder="القسم" className="border rounded-lg px-3 py-2" value={form.department} onChange={e=>setForm({...form,department:e.target.value})} />
          <input placeholder="المسمى" className="border rounded-lg px-3 py-2" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} />
          <button className="bg-[#123b70] text-white rounded-lg px-3 py-2">إضافة</button>
        </form>
        {msg && <div className="text-sm text-slate-600 mb-3">{msg}</div>}
        <div className="table-wrap"><table><thead><tr><th>الرقم</th><th>الاسم</th><th>القسم</th><th>المسمى</th><th>الحالة</th></tr></thead><tbody>
          {employees.map(e=> <tr key={e.id}><td>{e.employeeCode}</td><td>{e.name}</td><td>{e.department||"-"}</td><td>{e.title||"-"}</td><td>{e.status}</td></tr>)}
          {employees.length===0 && <tr><td colSpan={5} className="text-center text-slate-500 py-6">لا يوجد موظفون</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  );
}
