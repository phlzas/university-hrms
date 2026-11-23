import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fail, ok } from "@/lib/http";
import { canCreate, canRead } from "@/lib/permissions";
import { joinLogicalPath } from "@/lib/file-store";

// GET /api/documents
// قائمة المستندات القديمة (مسطحة) - legacy flat list, kept for backward compatibility
export async function GET() {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canRead(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);
    const documents = await prisma.document.findMany({
      where: { isDirectory: false },
      include: { employee: { select: { employeeCode: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok({ documents });
  } catch (e) {
    console.error("DOCUMENTS_GET_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}

// POST /api/documents
// رفع مستند بالطريقة القديمة - legacy upload endpoint (kept compatible with old UI/API)
export async function POST(req: Request) {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canCreate(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return fail("INVALID_CONTENT_TYPE", "نوع المحتوى غير صحيح - expected multipart/form-data", 415, { received: contentType });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const title = String(form.get("title") || file?.name || "document").trim();
    const category = String(form.get("category") || "").trim();
    const employeeCode = String(form.get("employeeCode") || "").trim();

    if (!file) return fail("MISSING_FILE", "الملف مطلوب - file is required", 400);

    // تخزين محلي (MVP) - local file storage for MVP; use secure object storage in production
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = path.join(uploadDir, safeName);
    await writeFile(filePath, bytes);

    const emp = employeeCode ? await prisma.employee.findUnique({ where: { employeeCode } }) : null;
    if (employeeCode && !emp) return fail("EMPLOYEE_NOT_FOUND", "كود الموظف غير موجود - employeeCode not found", 404);

    const name = title || file.name;
    const doc = await prisma.document.create({
      data: {
        employeeId: emp?.id,
        name,
        isDirectory: false,
        path: joinLogicalPath("/", name),
        category: category || null,
        fileName: file.name,
        filePath: `/uploads/${safeName}`,
        mimeType: file.type || null,
        size: file.size,
        uploadedBy: s.email,
      },
    });
    return ok({ document: doc }, 201);
  } catch (e) {
    console.error("DOCUMENTS_POST_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
