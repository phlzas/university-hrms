import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const employees = await prisma.employee.findMany({ orderBy: [{ name: "asc" }] });
  return NextResponse.json({ employees });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (s.role === "VIEWER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await req.json();
  const employeeCode = String(body.employeeCode || "").trim();
  const name = String(body.name || "").trim();
  if (!employeeCode || !name) return NextResponse.json({ error: "رقم الموظف والاسم مطلوبان" }, { status: 400 });
  const emp = await prisma.employee.create({
    data: {
      employeeCode, name,
      department: body.department || null,
      title: body.title || null,
      phone: body.phone || null,
      status: body.status || "ACTIVE",
    },
  });
  return NextResponse.json({ employee: emp }, { status: 201 });
}
