// src/app/api/files/route.ts
// API إدارة الملفات - File manager API (list/upload/create/move/copy/delete)
// يدعم الصلاحيات + تتبع النسخ/المستخدم - supports permissions + version/change tracking

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fail, ok, readJsonBody } from "@/lib/http";
import { canCreate, canDelete, canRead, canUpdate } from "@/lib/permissions";
import { joinLogicalPath, toFileManagerItem, writeUploadFile, deletePhysicalFile, getDescendantIds, getAccessibleDocumentWhere, canAccessDocument, canModifyFiles, snapshotVersion } from "@/lib/file-store";

async function actorLabel(session: any) {
  return session?.name || session?.email || "system";
}

// GET /api/files => قائمة الملفات المسموح بها - list files visible to current user
export async function GET() {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canRead(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);
    const where = await getAccessibleDocumentWhere(s);
    const docs = await prisma.document.findMany({
      where,
      include: { uploader: { select: { name: true, email: true } }, updater: { select: { name: true, email: true } } },
      orderBy: [{ isDirectory: "desc" }, { name: "asc" }],
    });
    return ok({ files: docs.map(toFileManagerItem) });
  } catch (e) {
    console.error("FILES_GET_ERROR", e);
    return fail("INTERNAL_ERROR", "خطأ داخلي - internal server error", 500);
  }
}

// POST /api/files => رفع/إنشاء/نقل/نسخ/حذف - multi-action endpoint
export async function POST(req: Request) {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canCreate(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    const contentType = String(req.headers.get("content-type") || "");

    // رفع ملف multipart - file upload
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      const parentPath = String(form.get("parentPath") || "/");
      const parent = parentPath && parentPath !== "/" ? await prisma.document.findFirst({ where: { path: parentPath, isDirectory: true } }) : null;
      if (parent && !(await canAccessDocument(s, parent))) return fail("FORBIDDEN", "لا تملك صلاحية هذا المجلد - folder access denied", 403);
      if (!file) return fail("MISSING_FILE", "الملف مطلوب - file is required", 400);

      const name = file.name;
      const logicalPath = joinLogicalPath(parent?.path || "/", name);
      const existing = await prisma.document.findFirst({ where: { path: logicalPath, isDirectory: false } });

      const stored = await writeUploadFile(file);
      const who = await actorLabel(s);

      // إذا نفس الملف موجود: أنشئ نسخة جديدة - same path => create a new version
      if (existing) {
        if (!(await canAccessDocument(s, existing))) return fail("FORBIDDEN", "لا تملك صلاحية تعديل هذا الملف - file access denied", 403);
        await snapshotVersion(existing, "UPLOAD");
        const updated = await prisma.document.update({
          where: { id: existing.id },
          data: {
            name,
            fileName: stored.stored,
            filePath: stored.rel,
            mimeType: stored.mimeType,
            size: stored.size,
            uploadedBy: who,
            uploadedById: s.sub,
            updatedById: s.sub,
            currentVersion: { increment: 1 },
          },
          include: { uploader: { select: { name: true, email: true } }, updater: { select: { name: true, email: true } } },
        });
        await prisma.documentVersion.create({
          data: { documentId: updated.id, version: updated.currentVersion, name: updated.name, fileName: updated.fileName, filePath: updated.filePath, mimeType: updated.mimeType, size: updated.size, uploadedBy: who, uploadedById: s.sub, action: "UPLOAD" },
        }).catch(() => null);
        return ok({ file: toFileManagerItem(updated), versioned: true }, 200);
      }

      const doc = await prisma.document.create({
        data: {
          parentId: parent?.id ?? null,
          name,
          isDirectory: false,
          path: logicalPath,
          fileName: stored.stored,
          filePath: stored.rel,
          mimeType: stored.mimeType,
          size: stored.size,
          uploadedBy: who,
          uploadedById: s.sub,
          updatedById: s.sub,
          currentVersion: 1,
          permissions: { create: { userId: s.sub, canView: true, grantedById: s.sub } }, // الرافع يرى ملفه تلقائياً - uploader auto-access
        },
        include: { uploader: { select: { name: true, email: true } }, updater: { select: { name: true, email: true } } },
      });
      await prisma.documentVersion.create({
        data: { documentId: doc.id, version: 1, name: doc.name, fileName: doc.fileName, filePath: doc.filePath, mimeType: doc.mimeType, size: doc.size, uploadedBy: who, uploadedById: s.sub, action: "UPLOAD" },
      }).catch(() => null);
      return ok({ file: toFileManagerItem(doc) }, 201);
    }

    const parsed = await readJsonBody<any>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data || {};
    const action = String(body.action || "");
    if (action === "delete" && !canDelete(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);
    if (action === "move" && !canUpdate(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    if (action === "createFolder") {
      const name = String(body.name || "").trim();
      const parentPath = String(body.parentPath || "/");
      if (!name) return fail("MISSING_NAME", "اسم المجلد مطلوب - folder name is required", 400);
      const parent = parentPath && parentPath !== "/" ? await prisma.document.findFirst({ where: { path: parentPath, isDirectory: true } }) : null;
      if (parent && !(await canAccessDocument(s, parent))) return fail("FORBIDDEN", "لا تملك صلاحية هذا المجلد - folder access denied", 403);
      const logicalPath = joinLogicalPath(parent?.path || "/", name);
      const exists = await prisma.document.findFirst({ where: { path: logicalPath } });
      if (exists) return fail("ALREADY_EXISTS", "العنصر موجود بالفعل - item already exists", 409);
      const doc = await prisma.document.create({
        data: { parentId: parent?.id ?? null, name, isDirectory: true, path: logicalPath, uploadedBy: await actorLabel(s), uploadedById: s.sub, updatedById: s.sub, permissions: { create: { userId: s.sub, canView: true, grantedById: s.sub } } },
        include: { uploader: { select: { name: true, email: true } }, updater: { select: { name: true, email: true } } },
      });
      return ok({ file: toFileManagerItem(doc) }, 201);
    }

    if (action === "delete") {
      const paths: string[] = Array.isArray(body.paths) ? body.paths : [];
      let deleted = 0;
      for (const p of paths) {
        const doc = await prisma.document.findFirst({ where: { path: p } });
        if (!doc) continue;
        if (!(await canAccessDocument(s, doc))) continue;
        if (!canModifyFiles(s.role) && doc.uploadedById !== s.sub) return fail("FORBIDDEN", "فقط الأدمن أو الرافع يمكنه الحذف - only admin/uploader can delete", 403);
        const ids = [doc.id, ...(doc.isDirectory ? await getDescendantIds(doc.id) : [])];
        const all = await prisma.document.findMany({ where: { id: { in: ids } } });
        const versions = await prisma.documentVersion.findMany({ where: { documentId: { in: ids } } });
        for (const f of all) await deletePhysicalFile(f.filePath);
        for (const v of versions) await deletePhysicalFile(v.filePath);
        await prisma.document.deleteMany({ where: { id: { in: ids } } });
        deleted++;
      }
      return ok({ deleted });
    }

    if (action === "move" || action === "copy") {
      const srcPaths: string[] = Array.isArray(body.paths) ? body.paths : [];
      const destPath = String(body.destinationPath || "/");
      const dest = destPath !== "/" ? await prisma.document.findFirst({ where: { path: destPath, isDirectory: true } }) : null;
      if (destPath !== "/" && !dest) return fail("DEST_NOT_FOUND", "مجلد الوجهة غير موجود - destination folder not found", 404);
      if (dest && !(await canAccessDocument(s, dest))) return fail("FORBIDDEN", "لا تملك صلاحية مجلد الوجهة - destination access denied", 403);
      const results: any[] = [];

      for (const src of srcPaths) {
        const doc = await prisma.document.findFirst({ where: { path: src } });
        if (!doc || !(await canAccessDocument(s, doc))) continue;
        const newPath = joinLogicalPath(dest?.path || "/", doc.name);

        if (action === "move") {
          if (!canModifyFiles(s.role) && doc.uploadedById !== s.sub) return fail("FORBIDDEN", "فقط الأدمن أو الرافع يمكنه النقل - only admin/uploader can move", 403);
          if (doc.isDirectory) {
            const descendants = await prisma.document.findMany({ where: { path: { startsWith: doc.path + "/" } } });
            await prisma.$transaction([
              prisma.document.update({ where: { id: doc.id }, data: { parentId: dest?.id ?? null, path: newPath, updatedById: s.sub } }),
              ...descendants.map((d) => prisma.document.update({ where: { id: d.id }, data: { path: newPath + d.path.slice(doc.path.length), updatedById: s.sub } })),
            ]);
          } else {
            await prisma.document.update({ where: { id: doc.id }, data: { parentId: dest?.id ?? null, path: newPath, updatedById: s.sub } });
          }
          const updated = await prisma.document.findUnique({ where: { id: doc.id }, include: { uploader: { select: { name: true, email: true } }, updater: { select: { name: true, email: true } } } });
          if (updated) results.push(toFileManagerItem(updated));
        } else {
          if (doc.isDirectory) continue; // MVP: نسخ المجلدات العميق لاحقاً - deep folder copy later
          const storedCopyName = `copy-${Date.now()}-${doc.fileName || "file"}`;
          // نسخ فعلي للملف لتجنب كسر النسخ عند الحذف - duplicate physical file to avoid shared-delete bug
          if (doc.filePath) {
            const fs = await import("fs/promises");
            const srcAbs = (await import("path")).join(process.cwd(), "public", doc.filePath.replace(/^\/+/, ""));
            const dstAbs = (await import("path")).join(process.cwd(), "public", "uploads", storedCopyName);
            await fs.copyFile(srcAbs, dstAbs).catch(() => null);
          }
          const copy = await prisma.document.create({
            data: {
              parentId: dest?.id ?? null,
              name: `Copy of ${doc.name}`,
              isDirectory: false,
              path: joinLogicalPath(dest?.path || "/", `Copy of ${doc.name}`),
              fileName: doc.filePath ? storedCopyName : doc.fileName,
              filePath: doc.filePath ? `/uploads/${storedCopyName}` : doc.filePath,
              mimeType: doc.mimeType,
              size: doc.size,
              uploadedBy: await actorLabel(s),
              uploadedById: s.sub,
              updatedById: s.sub,
              category: doc.category,
              currentVersion: 1,
              permissions: { create: { userId: s.sub, canView: true, grantedById: s.sub } },
            },
            include: { uploader: { select: { name: true, email: true } }, updater: { select: { name: true, email: true } } },
          });
          await prisma.documentVersion.create({ data: { documentId: copy.id, version: 1, name: copy.name, fileName: copy.fileName, filePath: copy.filePath, mimeType: copy.mimeType, size: copy.size, uploadedBy: copy.uploadedBy, uploadedById: s.sub, action: "UPLOAD" } }).catch(() => null);
          results.push(toFileManagerItem(copy));
        }
      }
      return ok({ files: results });
    }

    return fail("UNKNOWN_ACTION", "إجراء غير معروف - unknown action", 400, { action });
  } catch (e) {
    console.error("FILES_POST_ERROR", e);
    return fail("INTERNAL_ERROR", "خطأ داخلي - internal server error", 500);
  }
}
