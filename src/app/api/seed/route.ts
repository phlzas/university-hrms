import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function POST() {
  const email = "admin@hrms.local";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ ok: true, message: "seeded", user: { email, password: "Admin@12345" } });
  await prisma.user.create({ data: { email, name: "مدير النظام", passwordHash: await hashPassword("Admin@12345"), role: "ADMIN" } });
  await prisma.employee.createMany({ data: [
    { employeeCode: "1", name: "أحمد محمد علي", department: "الموارد البشرية", title: "أخصائي موارد بشرية" },
    { employeeCode: "2", name: "سارة خالد محمود", department: "الشؤون الإدارية", title: "منسق إداري" },
    { employeeCode: "3", name: "محمد عبد الله", department: "المالية", title: "محاسب" },
  ]});
  return NextResponse.json({ ok: true, user: { email, password: "Admin@12345" } });
}
