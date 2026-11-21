import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const where: any = {};
  if (status) where.status = status;
  const leaves = await prisma.leaveRequest.findMany({ where, include: { employee: { select: { employeeCode: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ leaves });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (s.role === "VIEWER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await req.json();
  const emp = await prisma.employee.findUnique({ where: { employeeCode: String(body.employeeCode || "").trim() } });
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  const startDate = new Date(String(body.startDate) + "T00:00:00Z");
  const endDate = new Date(String(body.endDate) + "T00:00:00Z");
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  const leave = await prisma.leaveRequest.create({ data: { employeeId: emp.id, type: String(body.type || "annual"), startDate, endDate, days, reason: body.reason || null, status: "PENDING" } });
  return NextResponse.json({ leave }, { status: 201 });
}
