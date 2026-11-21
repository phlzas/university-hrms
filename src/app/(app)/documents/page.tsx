"use client";
import { useEffect, useState } from "react";
export default function DocumentsPage(){
  const [docs,setDocs]=useState<any[]>([]); const [file,setFile]=useState<File|null>(null);
  const [form,setForm]=useState({title:"",category:"",employeeCode:""}); const [msg,setMsg]=useState("");
  async function load(){ const r=await fetch("/api/documents"); const d=await r.json(); setDocs(d.documents||[]); }
  useEffect(()=>{load();},[]);
  async function upload(e:React.FormEvent){ e.preventDefault(); if(!file) return; setMsg("جارٍ الرفع...");
    const fd=new FormData(); fd.append("file",file); fd.append("title",form.title); fd.append("category",form.category); fd.append("employeeCode",form.employeeCode);
    const r=await fetch("/api/documents",{method:"POST",body:fd}); const d=await r.json(); setMsg(r.ok?"تم رفع الوثيقة":(d.error||"فشل")); setFile(null); setForm({title:"",category:"",employeeCode:""}); load(); }
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold text-[#123b70]">الوثائق</h1><p className="text-slate-500">رفع وإدارة ملفات الموظفين والموارد البشرية</p></div>
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <form onSubmit={upload} className="grid md:grid-cols-5 gap-2">
        <input placeholder="عنوان الوثيقة" className="border rounded-lg px-3 py-2" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} />
        <input placeholder="التصنيف" className="border rounded-lg px-3 py-2" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} />
        <input placeholder="رقم الموظف (اختياري)" className="border rounded-lg px-3 py-2" value={form.employeeCode} onChange={e=>setForm({...form,employeeCode:e.target.value})} />
        <input type="file" className="text-sm border rounded-lg px-2 py-2" onChange={e=>setFile(e.target.files?.[0]||null)} />
        <button className="bg-[#123b70] text-white rounded-lg px-3 py-2">رفع</button>
      </form>
      {msg && <div className="text-sm text-slate-600">{msg}</div>}
      <div className="table-wrap"><table><thead><tr><th>العنوان</th><th>التصنيف</th><th>الموظف</th><th>الملف</th><th>التاريخ</th></tr></thead><tbody>
        {docs.map(d=> <tr key={d.id}><td>{d.title}</td><td>{d.category||"-"}</td><td>{d.employee?`${d.employee.name} (${d.employee.employeeCode})`:"-"}</td><td><a className="text-blue-700 underline" href={d.filePath} target="_blank">فتح</a></td><td>{String(d.createdAt).slice(0,10)}</td></tr>)}
        {docs.length===0 && <tr><td colSpan={5} className="text-center text-slate-500 py-6">لا توجد وثائق</td></tr>}
      </tbody></table></div>
    </div></div>;
}
