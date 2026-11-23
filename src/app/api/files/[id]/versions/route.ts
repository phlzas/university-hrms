// src/app/api/files/[id]/versions/route.ts
// سجل إصدارات الملف - file version history endpoint

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fail, ok } from '@/lib/http';
import { canRead } from '@/lib/permissions';
import { canAccessDocument } from '@/lib/file-store';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const s = await getSession();
    if (!s) return fail('UNAUTHORIZED', 'غير مصرح - authentication required', 401);
    if (!canRead(s.role)) return fail('FORBIDDEN', 'غير مصرح - forbidden', 403);
    const { id } = await ctx.params;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return fail('NOT_FOUND', 'الملف غير موجود - file not found', 404);
    if (!(await canAccessDocument(s, doc))) return fail('FORBIDDEN', 'لا تملك صلاحية - access denied', 403);
    const versions = await prisma.documentVersion.findMany({
      where: { documentId: id },
      include: { uploader: { select: { name: true, email: true } } },
      orderBy: { version: 'desc' },
    });
    return ok({ versions: versions.map((v) => ({ id: v.id, version: v.version, name: v.name, size: v.size, mimeType: v.mimeType, action: v.action, createdAt: v.createdAt, uploadedBy: v.uploader?.name || v.uploader?.email || v.uploadedBy, uploadedById: v.uploadedById })) });
  } catch (e) {
    console.error('FILE_VERSIONS_ERROR', e);
    return fail('INTERNAL_ERROR', 'خطأ داخلي - internal server error', 500);
  }
}