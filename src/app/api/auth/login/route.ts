import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!user || !user.active) return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    const ok = await verifyPassword(String(password), user.passwordHash);
    if (!ok) return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    await createSession({ sub: user.id, email: user.email, role: user.role, name: user.name });
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
