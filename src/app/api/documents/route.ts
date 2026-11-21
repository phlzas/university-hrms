import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const documents = await prisma.document.findMany({ include: { employee: { select: { employeeCode: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ documents });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (s.role === "VIEWER") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const title = String(form.get("title") || file?.name || "document");
  const category = String(form.get("category") || "");
  const employeeCode = String(form.get("employeeCode") || "").trim();
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(uploadDir, safeName);
  await writeFile(filePath, bytes);
  const emp = employeeCode ? await prisma.employee.findUnique({ where: { employeeCode } }) : null;
  const doc = await prisma.document.create({ data: { employeeId: emp?.id, title, category: category || null, fileName: file.name, filePath: `/uploads/${safeName}`, mimeType: file.type || null, size: file.size, uploadedBy: s.email } });
  return NextResponse.json({ document: doc }, { status: 201 });
}
