// src/app/api/files/download/route.ts
// تنزيل ملف مع فحص الصلاحيات - download file with permission checks

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fail } from '@/lib/http';
import { canRead } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { canAccessDocument } from '@/lib/file-store';

export async function GET(req: Request) {
  try {
    const s = await getSession();
    if (!s) return fail('UNAUTHORIZED', 'غير مصرح - authentication required', 401);
    if (!canRead(s.role)) return fail('FORBIDDEN', 'غير مصرح - forbidden', 403);
    const { searchParams } = new URL(req.url);
    const p = String(searchParams.get('path') || '');
    const version = searchParams.get('version');
    if (!p) return fail('MISSING_PATH', 'المسار مطلوب - path is required', 400);
    const doc = await prisma.document.findFirst({ where: { path: p, isDirectory: false } });
    if (!doc) return fail('NOT_FOUND', 'الملف غير موجود - file not found', 404);
    if (!(await canAccessDocument(s, doc))) return fail('FORBIDDEN', 'لا تملك صلاحية تحميل هذا الملف - access denied', 403);

    let filePath = doc.filePath;
    let name = doc.name;
    let mime = doc.mimeType || 'application/octet-stream';
    if (version) {
      const v = await prisma.documentVersion.findFirst({ where: { documentId: doc.id, version: Number(version) } });
      if (!v?.filePath) return fail('VERSION_NOT_FOUND', 'الإصدار غير موجود - version not found', 404);
      filePath = v.filePath; name = v.name || name; mime = v.mimeType || mime;
    }
    if (!filePath) return fail('NOT_FOUND', 'مسار الملف مفقود - file path missing', 404);
    const abs = path.join(process.cwd(), 'public', filePath.replace(/^\/+/, ''));
    const bytes = await readFile(abs);
    return new NextResponse(bytes, { headers: { 'Content-Type': mime, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } });
  } catch (e) {
    console.error('FILE_DOWNLOAD_ERROR', e);
    return fail('INTERNAL_ERROR', 'خطأ داخلي - internal server error', 500);
  }
}