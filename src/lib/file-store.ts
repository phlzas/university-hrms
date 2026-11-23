// src/lib/file-store.ts
// مساعدات تخزين الملفات - File storage helpers
// تخزين فعلي على القرص + مسارات منطقية في DB + صلاحيات وإصدارات - disk storage, logical paths, permissions, versions

import path from "path";
import { mkdir, writeFile, rm } from "fs/promises";
import { prisma } from "@/lib/db";
import { hasCapability } from "@/lib/permissions";

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export type SessionLike = { sub: string; email: string; role: string; name: string };

// ensureUploadDir() => يتأكد من وجود مجلد الرفع - ensure upload directory exists
export async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

// safeName() => تنظيف اسم الملف - sanitize file name for disk storage
export function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._\-\u0600-\u06FF ]/g, "_");
}

// joinLogicalPath() => بناء مسار منطقي - build logical path
export function joinLogicalPath(parentPath: string | null | undefined, name: string) {
  const base = !parentPath || parentPath === "/" ? "" : parentPath.replace(/\/+$/, "");
  return `${base}/${name}`.replace(/\/+/g, "/");
}

// canReadAllFiles() => هل الدور يرى كل المستندات؟ - role has full document visibility
export function canReadAllFiles(role?: string | null) {
  return hasCapability(role, "readAllFiles");
}

// canModifyFiles() => صلاحية تعديل الملفات - role can modify files
export function canModifyFiles(role?: string | null) {
  return hasCapability(role, "update");
}

// canManageFilePermissions() => صلاحية منح/إزالة صلاحيات الملفات - role can grant/revoke file access
export function canManageFilePermissions(role?: string | null) {
  return hasCapability(role, "managePermissions");
}

// isAdmin() => توافق قديم لرؤية كل المستندات - legacy alias for full document visibility
export function isAdmin(role?: string | null) {
  return canReadAllFiles(role);
}

// canManageFiles() => توافق قديم لصلاحية التعديل - legacy alias for modify capability
export function canManageFiles(role?: string | null) {
  return canModifyFiles(role);
}

// toFileManagerItem() => تحويل سجل DB لشكل cubone - map DB document to file manager shape
export function toFileManagerItem(doc: any) {
  return {
    id: doc.id,
    name: doc.name,
    isDirectory: !!doc.isDirectory,
    path: doc.path,
    updatedAt: doc.updatedAt?.toISOString?.() || doc.updatedAt,
    createdAt: doc.createdAt?.toISOString?.() || doc.createdAt,
    size: doc.size ?? undefined,
    filePath: doc.filePath ?? undefined,
    mimeType: doc.mimeType ?? undefined,
    category: doc.category ?? undefined,
    employeeId: doc.employeeId ?? undefined,
    parentId: doc.parentId ?? null,
    uploadedBy: doc.uploadedBy ?? doc.uploader?.name ?? doc.uploader?.email ?? null,
    uploadedById: doc.uploadedById ?? null,
    updatedBy: doc.updater?.name ?? doc.updater?.email ?? doc.updatedBy ?? null,
    updatedById: doc.updatedById ?? null,
    currentVersion: doc.currentVersion ?? 1,
  };
}

// writeUploadFile() => حفظ ملف مرفوع على القرص - persist uploaded file to disk and return metadata
export async function writeUploadFile(file: File) {
  await ensureUploadDir();
  const stored = `${Date.now()}-${safeName(file.name)}`;
  const abs = path.join(UPLOAD_DIR, stored);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, bytes);
  return { stored, abs, rel: `/uploads/${stored}`, size: file.size, mimeType: file.type || null };
}

// deletePhysicalFile() => حذف الملف الفعلي إن وجد - remove physical file if present
export async function deletePhysicalFile(relPath?: string | null) {
  if (!relPath) return;
  const abs = path.join(process.cwd(), "public", relPath.replace(/^\/+/, ""));
  await rm(abs, { force: true });
}

// getDescendantIds() => جمع كل الأبناء/الأحفاد - collect all descendant ids
export async function getDescendantIds(rootId: string): Promise<string[]> {
  const kids = await prisma.document.findMany({ where: { parentId: rootId }, select: { id: true } });
  const ids: string[] = [];
  for (const k of kids) {
    ids.push(k.id);
    ids.push(...await getDescendantIds(k.id));
  }
  return ids;
}

// getAncestorIds() => جمع الآباء للأعلى - collect ancestor ids for permission inheritance
export async function getAncestorIds(docId: string | null | undefined): Promise<string[]> {
  if (!docId) return [];
  const doc = await prisma.document.findUnique({ where: { id: docId }, select: { id: true, parentId: true } });
  if (!doc) return [];
  const parentChain = doc.parentId ? await getAncestorIds(doc.parentId) : [];
  return [doc.id, ...parentChain];
}

// getAccessibleDocumentWhere() => فلتر الصلاحيات - Prisma where for documents visible to session
export async function getAccessibleDocumentWhere(session: SessionLike) {
  if (canReadAllFiles(session.role)) return {}; // الأدمن يرى كل شيء - privileged roles see all
  const permDocs = await prisma.documentPermission.findMany({ where: { userId: session.sub, canView: true }, select: { documentId: true } });
  const permittedIds = permDocs.map((p) => p.documentId);
  const permittedDocs = permittedIds.length ? await prisma.document.findMany({ where: { id: { in: permittedIds } }, select: { id: true, path: true, isDirectory: true } }) : [];
  // صلاحية المجلد تشمل الأحفاد - folder permission grants subtree visibility
  const pathOr = permittedDocs.filter((d) => d.isDirectory).map((d) => ({ path: { startsWith: d.path === "/" ? "/" : d.path + "/" } }));
  const idOr = permittedIds.length ? [{ id: { in: permittedIds } }] : [];
  return {
    OR: [
      { uploadedById: session.sub },
      ...idOr,
      ...pathOr,
    ],
  };
}

// canAccessDocument() => فحص صلاحية عنصر واحد - check access for a specific document
export async function canAccessDocument(session: SessionLike, doc: { id: string; path: string; isDirectory: boolean; uploadedById?: string | null }) {
  if (canReadAllFiles(session.role)) return true;
  if (doc.uploadedById && doc.uploadedById === session.sub) return true;
  const ancestorIds = await getAncestorIds(doc.id);
  const perm = await prisma.documentPermission.findFirst({ where: { userId: session.sub, canView: true, documentId: { in: ancestorIds } }, select: { id: true } });
  if (perm) return true;
  // أيضا تحقق لو أي مجلد أب له صلاحية بالمسار - also allow if any permitted ancestor folder covers path
  const folderPerms = await prisma.documentPermission.findMany({ where: { userId: session.sub, canView: true }, include: { document: { select: { path: true, isDirectory: true } } } });
  return folderPerms.some((p) => p.document.isDirectory && (doc.path === p.document.path || doc.path.startsWith(p.document.path + "/")));
}

// snapshotVersion() => حفظ نسخة تاريخية - snapshot current file state as version record
export async function snapshotVersion(doc: any, action = "UPLOAD") {
  if (doc.isDirectory || !doc.filePath) return null;
  return prisma.documentVersion.create({
    data: {
      documentId: doc.id,
      version: doc.currentVersion ?? 1,
      name: doc.name,
      fileName: doc.fileName,
      filePath: doc.filePath,
      mimeType: doc.mimeType,
      size: doc.size,
      uploadedBy: doc.uploadedBy,
      uploadedById: doc.uploadedById,
      action,
    },
  });
}
