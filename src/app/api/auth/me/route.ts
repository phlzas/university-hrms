import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ user: null }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: s.sub }, select: { id: true, email: true, name: true, role: true, active: true } });
  if (!user || !user.active) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
