// src/app/api/files/[id]/route.ts
// إعادة تسمية/تحديث ملف - rename/update file or folder with permission checks

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fail, ok, readJsonBody } from '@/lib/http';
import { canUpdate } from '@/lib/permissions';
import { toFileManagerItem, canAccessDocument, canModifyFiles } from '@/lib/file-store';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const s = await getSession();
    if (!s) return fail('UNAUTHORIZED', 'غير مصرح - authentication required', 401);
    if (!canUpdate(s.role)) return fail('FORBIDDEN', 'غير مصرح - forbidden', 403);
    const { id } = await ctx.params;
    const parsed = await readJsonBody<any>(req);
    if ('error' in parsed) return parsed.error;
    const name = String(parsed.data?.name || '').trim();
    if (!name) return fail('MISSING_NAME', 'الاسم مطلوب - name is required', 400);

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return fail('NOT_FOUND', 'العنصر غير موجود - item not found', 404);
    if (!(await canAccessDocument(s, doc))) return fail('FORBIDDEN', 'لا تملك صلاحية هذا العنصر - access denied', 403);
    if (!canModifyFiles(s.role) && doc.uploadedById !== s.sub) return fail('FORBIDDEN', 'فقط الأدمن أو الرافع يمكنه التعديل - only admin/uploader can rename', 403);

    const parentPath = doc.path.split('/').slice(0, -1).join('/') || '/';
    const newPath = `${parentPath === '/' ? '' : parentPath}/${name}`.replace(/\/+/g, '/');
    const exists = await prisma.document.findFirst({ where: { path: newPath, NOT: { id } } });
    if (exists) return fail('ALREADY_EXISTS', 'اسم موجود بالفعل - name already exists', 409);

    if (doc.isDirectory) {
      const descendants = await prisma.document.findMany({ where: { path: { startsWith: doc.path + '/' } } });
      await prisma.$transaction([
        prisma.document.update({ where: { id }, data: { name, path: newPath, updatedById: s.sub } }),
        ...descendants.map((d) => prisma.document.update({ where: { id: d.id }, data: { path: newPath + d.path.slice(doc.path.length), updatedById: s.sub } })),
      ]);
    } else {
      await prisma.document.update({ where: { id }, data: { name, path: newPath, updatedById: s.sub } });
    }
    const updated = await prisma.document.findUnique({ where: { id }, include: { uploader: { select: { name: true, email: true } }, updater: { select: { name: true, email: true } } } });
    return ok({ file: toFileManagerItem(updated!) });
  } catch (e) {
    console.error('FILE_PATCH_ERROR', e);
    return fail('INTERNAL_ERROR', 'خطأ داخلي - internal server error', 500);
  }
}