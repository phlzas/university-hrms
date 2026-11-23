// src/app/api/files/[id]/permissions/route.ts
// صلاحيات الملفات - admin grants/revokes document visibility

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fail, ok, readJsonBody } from '@/lib/http';
import { canManagePermissions, canRead } from '@/lib/permissions';
import { canAccessDocument } from '@/lib/file-store';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const s = await getSession();
    if (!s) return fail('UNAUTHORIZED', 'غير مصرح - authentication required', 401);
    if (!canRead(s.role)) return fail('FORBIDDEN', 'غير مصرح - forbidden', 403);
    const { id } = await ctx.params;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return fail('NOT_FOUND', 'العنصر غير موجود - not found', 404);
    if (!(await canAccessDocument(s, doc))) return fail('FORBIDDEN', 'لا تملك صلاحية - access denied', 403);
    const perms = await prisma.documentPermission.findMany({ where: { documentId: id }, include: { user: { select: { id: true, name: true, email: true, role: true } }, grantedBy: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } });
    const users = canManagePermissions(s.role) ? await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } }) : [];
    return ok({ permissions: perms, users, canManage: canManagePermissions(s.role) });
  } catch (e) { console.error('FILE_PERMS_GET_ERROR', e); return fail('INTERNAL_ERROR', 'خطأ داخلي - internal server error', 500); }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const s = await getSession();
    if (!s) return fail('UNAUTHORIZED', 'غير مصرح - authentication required', 401);
    if (!canManagePermissions(s.role)) return fail('FORBIDDEN', 'غير مصرح - forbidden', 403);
    const { id } = await ctx.params;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return fail('NOT_FOUND', 'العنصر غير موجود - not found', 404);
    const parsed = await readJsonBody<any>(req);
    if ('error' in parsed) return parsed.error;
    const userId = String(parsed.data?.userId || '').trim();
    const canView = parsed.data?.canView !== false;
    if (!userId) return fail('MISSING_USER', 'المستخدم مطلوب - userId required', 400);
    const perm = await prisma.documentPermission.upsert({
      where: { documentId_userId: { documentId: id, userId } },
      update: { canView, grantedById: s.sub },
      create: { documentId: id, userId, canView, grantedById: s.sub },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    return ok({ permission: perm }, 201);
  } catch (e) { console.error('FILE_PERMS_POST_ERROR', e); return fail('INTERNAL_ERROR', 'خطأ داخلي - internal server error', 500); }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const s = await getSession();
    if (!s) return fail('UNAUTHORIZED', 'غير مصرح - authentication required', 401);
    if (!canManagePermissions(s.role)) return fail('FORBIDDEN', 'غير مصرح - forbidden', 403);
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const userId = String(searchParams.get('userId') || '');
    if (!userId) return fail('MISSING_USER', 'المستخدم مطلوب - userId required', 400);
    await prisma.documentPermission.deleteMany({ where: { documentId: id, userId } });
    return ok({ removed: true });
  } catch (e) { console.error('FILE_PERMS_DELETE_ERROR', e); return fail('INTERNAL_ERROR', 'خطأ داخلي - internal server error', 500); }
}