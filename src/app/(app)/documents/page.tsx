"use client";
// إدارة الملفات - مساحة عمل شبيهة بـ Drive: تفاصيل عند الطلب وإجراءات مشاركة صريحة
// Drive-like documents workspace — on-demand details panel + explicit info/share actions

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileItem } from "@cubone/react-file-manager";
import { useSession } from "@/lib/use-session";
import "@cubone/react-file-manager/dist/style.css";

const FileManager = dynamic(() => import("@cubone/react-file-manager").then((m) => m.FileManager), { ssr: false });

/* ── الأنواع / Types ─────────────────────────────────────────────────────── */
type DocItem = {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  mimeType?: string;
  updatedAt?: string;
  uploadedBy?: string | null;
  updatedBy?: string | null;
  currentVersion?: number;
};

type VersionItem = {
  id: string;
  version: number;
  action: string;
  uploadedBy?: string | null;
  createdAt?: string;
  size?: number;
};

type PermUser = { id: string; name: string; email: string; role: string };
type PermItem = { id: string; userId: string; user?: PermUser | null };

type ApiErrorShape = { error?: string | { message?: string } };
type FilesPayload = ApiErrorShape & { files?: DocItem[] };
type VersionsPayload = ApiErrorShape & { versions?: VersionItem[] };
type PermissionsPayload = ApiErrorShape & { permissions?: PermItem[]; users?: PermUser[]; canManage?: boolean };
type PanelTab = "details" | "versions" | "permissions";

/* ── مساعدات / Helpers ───────────────────────────────────────────────────── */
async function parseJson<T>(res: Response): Promise<T | null> {
  // JSON قد يكون تالفًا؛ نُعيد null بدل رمي استثناء / JSON may be malformed; return null instead of throwing
  try { return (await res.json()) as T; } catch { return null; }
}

function getErrorMessage(data: ApiErrorShape | null, fallback: string): string {
  if (!data) return fallback;
  if (typeof data.error === "string") return data.error;
  if (data.error && typeof data.error === "object" && typeof data.error.message === "string") return data.error.message;
  return fallback;
}

// تحويل عنصر المكتبة إلى شكل مستنداتنا دون استخدام any / Map library item to our document shape without any
function toDoc(file: FileItem): DocItem {
  return {
    id: String(file.id ?? ""),
    name: String(file.name ?? ""),
    path: String(file.path ?? ""),
    isDirectory: Boolean(file.isDirectory),
    size: typeof file.size === "number" ? file.size : undefined,
    mimeType: typeof file.mimeType === "string" ? file.mimeType : undefined,
    updatedAt: typeof file.updatedAt === "string" ? file.updatedAt : undefined,
    uploadedBy: typeof file.uploadedBy === "string" ? file.uploadedBy : undefined,
    updatedBy: typeof file.updatedBy === "string" ? file.updatedBy : undefined,
    currentVersion: typeof file.currentVersion === "number" ? file.currentVersion : undefined,
  };
}

function extOf(name = ""): string { const i = name.lastIndexOf("."); return i >= 0 ? name.slice(i + 1).toLowerCase() : ""; }
function previewUrl(file: Pick<DocItem, "path">, version?: number): string { const v = version ? `&version=${version}` : ""; return `/api/files/download?path=${encodeURIComponent(file.path || "")}${v}`; }
function fmtSize(bytes?: number): string { if (!bytes && bytes !== 0) return "—"; if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function fmtDate(d?: string): string { if (!d) return "—"; try { return new Date(d).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" }); } catch { return d; } }

const TEXT_PREVIEW_EXTS = ["txt", "csv", "json", "md", "log", "xml", "html", "css", "js", "ts"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

// قصّ أسماء الملفات على سطرين بدل انضغاطها داخل شبكة المكتبة / Clamp names to two lines instead of smushing in the library grid
// النطاق محصور بـ .fm-shell حتى لا تتأثر أي مكتبة أخرى / Scoped to .fm-shell so no other component is affected
const FM_NAME_CSS = `
.fm-shell .files .file-item { height: auto !important; min-height: 96px; padding-block: 10px 6px; }
.fm-shell .files .file-item .file-name {
  max-width: 100% !important; width: 100%; display: -webkit-box; -webkit-box-orient: vertical;
  -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; overflow-wrap: anywhere;
  line-height: 1.35; text-align: center; font-size: .82rem;
}
.fm-shell .files.list .file-item { height: auto !important; min-height: 44px; }
.fm-shell .files.list .file-item .file-name {
  max-width: 100% !important; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
`;

/* ── أيقونات متجهية / Vector icons (لا رموز تعبيرية كأيقونات) ─────────────── */
function DotsIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>;
}
function InfoIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
}
function ShareIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.6l6.8-4M8.6 13.4l6.8 4" /></svg>;
}
function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

export default function DocumentsPage() {
  const session = useSession();
  const [files, setFiles] = useState<DocItem[]>([]);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<DocItem | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [details, setDetails] = useState<DocItem | null>(null);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [perms, setPerms] = useState<PermItem[]>([]);
  const [permUsers, setPermUsers] = useState<PermUser[]>([]);
  const [canManagePerms, setCanManagePerms] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("details");
  const [loadingPanel, setLoadingPanel] = useState(false);

  // التحديد يُغذّي قائمة الإجراءات فقط — لا يفتح لوحة التفاصيل أبدًا
  // Selection feeds the action menu only — it never opens the details panel.
  const [selected, setSelected] = useState<DocItem | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const docxRef = useRef<HTMLDivElement | null>(null);
  const previewCloseRef = useRef<HTMLButtonElement | null>(null);

  const { canCreate, canUpdate, canDelete, canManagePermissions } = session;
  // صلاحيات الملفات من المصفوفة المشتركة؛ التنزيل والتفاصيل متاحة للجميع وفق ACL الخادم
  // File capabilities come from the shared matrix; download/details stay available subject to server ACLs
  const mayManagePerms = canManagePermissions && canManagePerms;

  const loadFiles = useCallback(async () => {
    try {
      const r = await fetch("/api/files", { cache: "no-store" });
      const d = await parseJson<FilesPayload>(r);
      if (!r.ok) { setMsg(getErrorMessage(d, "فشل تحميل الملفات")); return; }
      setFiles(d?.files || []);
      setMsg("");
    } catch { setMsg("تعذر الاتصال بالخادم"); }
  }, []);

  useEffect(() => { void loadFiles(); }, [loadFiles]);

  // إغلاق قائمة الإجراءات عند النقر خارجها أو الضغط Escape / Close action menu on outside click or Escape
  useEffect(() => {
    if (!actionMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (e.target instanceof Node && actionMenuRef.current && !actionMenuRef.current.contains(e.target)) setActionMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActionMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [actionMenuOpen]);

  useEffect(() => {
    if (!preview) return;
    previewCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  const loadPanel = useCallback(async (file: DocItem, tab: PanelTab = "details") => {
    setDetails(file); setPanelTab(tab); setVersions([]); setPerms([]); setPermUsers([]); setCanManagePerms(false); setLoadingPanel(true);
    try {
      const [vRes, pRes] = await Promise.all([
        fetch(`/api/files/${encodeURIComponent(file.id)}/versions`, { cache: "no-store" }),
        fetch(`/api/files/${encodeURIComponent(file.id)}/permissions`, { cache: "no-store" }),
      ]);
      const v = await parseJson<VersionsPayload>(vRes);
      const p = await parseJson<PermissionsPayload>(pRes);
      if (vRes.ok) setVersions(v?.versions || []);
      if (pRes.ok) { setPerms(p?.permissions || []); setPermUsers(p?.users || []); setCanManagePerms(Boolean(p?.canManage)); }
    } finally { setLoadingPanel(false); }
  }, []);

  const onRefresh = async () => { await loadFiles(); if (details) await loadPanel(details, panelTab); };

  const onCreateFolder = async (name: string, parent: FileItem) => {
    if (!canCreate) return;
    const r = await fetch("/api/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createFolder", name, parentPath: parent?.path || "/" }) });
    const d = await parseJson<ApiErrorShape>(r);
    if (!r.ok) throw new Error(getErrorMessage(d, "فشل إنشاء المجلد"));
    await loadFiles();
  };

  const onRename = async (file: FileItem, newName: string) => {
    if (!canUpdate) return;
    const doc = toDoc(file);
    const r = await fetch(`/api/files/${encodeURIComponent(doc.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) });
    const d = await parseJson<ApiErrorShape>(r);
    if (!r.ok) throw new Error(getErrorMessage(d, "فشل إعادة التسمية"));
    await loadFiles();
    // تحديث اللوحة المفتوحة حتى لا تعرض اسمًا قديمًا / Keep an open panel in sync after rename
    if (details?.id === doc.id) await loadPanel({ ...doc, name: newName }, panelTab);
  };

  const onDelete = async (items: FileItem[]) => {
    if (!canDelete) return;
    const docs = items.map(toDoc);
    const r = await fetch("/api/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", paths: docs.map((i) => i.path) }) });
    const d = await parseJson<ApiErrorShape>(r);
    if (!r.ok) throw new Error(getErrorMessage(d, "فشل الحذف"));
    if (details && docs.some((i) => i.id === details.id)) setDetails(null);
    if (selected && docs.some((i) => i.id === selected.id)) { setSelected(null); setActionMenuOpen(false); }
    await loadFiles();
  };

  const onPaste = async (items: FileItem[], destination: FileItem, operation: "copy" | "move") => {
    if (operation === "move" ? !canUpdate : !canCreate) return;
    const docs = items.map(toDoc);
    const r = await fetch("/api/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: operation, paths: docs.map((i) => i.path), destinationPath: toDoc(destination).path || "/" }) });
    const d = await parseJson<ApiErrorShape>(r);
    if (!r.ok) throw new Error(getErrorMessage(d, "فشلت العملية"));
    await loadFiles();
  };

  const onDownload = async (items: FileItem[]) => {
    for (const it of items.map(toDoc)) {
      if (it.isDirectory) continue;
      const a = document.createElement("a");
      a.href = previewUrl(it); a.download = it.name;
      document.body.appendChild(a); a.click(); a.remove();
    }
  };

  const onFileUploading = (_file: File, parent: FileItem) => ({ parentPath: toDoc(parent).path || "/" });
  const onFileUploaded = async () => { await loadFiles(); if (details) await loadPanel(details, panelTab); };
  const onError = (err: { type: string; message: string }) => { setMsg(err?.message || "خطأ في مدير الملفات"); };

  const openPreview = async (file: DocItem) => {
    // المعاينة إجراء صريح مستقل — لوحة التفاصيل تُفتح عبر زر Info فقط
    // Preview is an explicit standalone action — the details panel opens only via the Info action.
    setPreview(file); setPreviewText("");
    if (TEXT_PREVIEW_EXTS.includes(extOf(file.name))) {
      try { const r = await fetch(previewUrl(file)); setPreviewText(await r.text()); } catch { setPreviewText("تعذر معاينة الملف"); }
    }
  };

  useEffect(() => {
    void (async () => {
      if (!preview || extOf(preview.name) !== "docx" || !docxRef.current) return;
      try {
        const mod = await import("docx-preview");
        const res = await fetch(previewUrl(preview));
        const buf = await res.arrayBuffer();
        if (!docxRef.current) return;
        docxRef.current.innerHTML = "";
        await mod.renderAsync(buf, docxRef.current, undefined, { inWrapper: true, ignoreWidth: false });
      } catch {
        // نص ثابت فقط — لا نحقن أي محتوى من اسم الملف / Static text only — never inject untrusted file names
        if (docxRef.current) docxRef.current.textContent = "فشلت معاينة DOCX";
      }
    })();
  }, [preview]);

  const previewBody = useMemo(() => {
    if (!preview) return null;
    const ext = extOf(preview.name);
    const url = previewUrl(preview);
    if (IMAGE_EXTS.includes(ext)) return <img src={url} alt={preview.name} className="max-h-[72vh] mx-auto rounded-[var(--radius-lg)]" />;
    if (ext === "pdf") return <iframe src={url} className="w-full h-[72vh] border-0 rounded-[var(--radius-lg)] bg-[var(--surface-alt)]" title={preview.name} />;
    if (TEXT_PREVIEW_EXTS.includes(ext)) return <pre className="text-xs whitespace-pre-wrap bg-[var(--surface-alt)] border border-[var(--border-subtle)] p-4 rounded-[var(--radius-lg)] max-h-[72vh] overflow-auto">{previewText || "جاري تحميل المعاينة..."}</pre>;
    if (ext === "docx") return <div ref={docxRef} className="bg-[var(--surface)] max-h-[72vh] overflow-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)]" />;
    const extraNote = ["xlsx", "xls"].includes(ext) ? "معاينة Excel الكاملة تحتاج عارضًا مخصصًا (MVP)." : null;
    return (
      <div className="p-5 text-sm text-[var(--text)] bg-[var(--surface-alt)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)]" role="status">
        <p className="font-medium">لا توجد معاينة مباشرة لهذا النوع. استخدم التنزيل أو افتح التفاصيل.</p>
        {extraNote && <p className="mt-1 text-xs muted">{extraNote}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={url} className="btn btn-primary">تنزيل</a>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { const file = preview; setPreview(null); void loadPanel(file, "details"); }}
          >
            التفاصيل
          </button>
        </div>
      </div>
    );
  }, [preview, previewText, loadPanel]);

  async function grantPermission(userId: string) {
    if (!details || !mayManagePerms) return;
    const r = await fetch(`/api/files/${encodeURIComponent(details.id)}/permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, canView: true }) });
    const d = await parseJson<ApiErrorShape>(r);
    if (!r.ok) { setMsg(getErrorMessage(d, "فشل منح الصلاحية")); return; }
    await loadPanel(details, "permissions"); setMsg("تم تحديث الصلاحية");
  }

  async function revokePermission(userId: string) {
    if (!details || !mayManagePerms) return;
    const r = await fetch(`/api/files/${encodeURIComponent(details.id)}/permissions?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    const d = await parseJson<ApiErrorShape>(r);
    if (!r.ok) { setMsg(getErrorMessage(d, "فشل إزالة الصلاحية")); return; }
    await loadPanel(details, "permissions");
  }

  // فتح اللوحة دائمًا عبر إجراء صريح من قائمة الثلاث نقاط / Panel always opens via an explicit 3-dots action
  const openInfo = () => { if (!selected) return; void loadPanel(selected, "details"); setActionMenuOpen(false); };
  const openShare = () => { if (!selected || !canManagePermissions) return; void loadPanel(selected, "permissions"); setActionMenuOpen(false); };

  return <div className="space-y-4">
    <style>{FM_NAME_CSS}</style>

    {/* ترويسة مدمجة — بلا لافتة كبيرة أو بطاقات إحصائية / Compact header — no big banner or stat cards */}
    <header className="flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h1 className="page-title">إدارة الملفات</h1>
        <p className="page-sub">مساحة ملفات آمنة مع صلاحيات وتتبع إصدارات • Secure files with permissions and versions</p>
      </div>
      <span className="text-xs muted">{files.length} عنصر</span>
    </header>

    {msg && <div role="status" className="text-sm text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2">{msg}</div>}

    <section className={`grid ${details ? "xl:grid-cols-[1fr_340px]" : "xl:grid-cols-1"} gap-4 md:gap-5 items-start`}>
      <div className="app-card p-2 md:p-3 fm-shell min-w-0">
        {/* شريط إجراءات صريح متوافق مع مدير الملفات / Explicit action bar compatible with FileManager */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-1 pb-2 mb-1">
          <div className="min-w-0 text-xs muted truncate">
            {selected ? <><span className="font-semibold text-[var(--primary)]">المحدد: </span>{selected.name}</> : "اختر عنصرًا لعرض الإجراءات • Select an item for actions"}
          </div>
          <div className="relative shrink-0" ref={actionMenuRef}>
            <button
              type="button"
              aria-label="إجراءات العنصر • Item actions"
              aria-haspopup="menu"
              aria-expanded={actionMenuOpen}
              disabled={!selected}
              onClick={() => setActionMenuOpen((v) => !v)}
              className="btn btn-ghost !px-2.5 !py-1.5"
              title="إجراءات • Actions"
            >
              <DotsIcon />
            </button>
            {actionMenuOpen && selected && (
              <div role="menu" aria-label="إجراءات العنصر • Item actions" className="absolute z-30 top-full mt-1 w-60 max-w-[calc(100vw-2rem)] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-lg overflow-hidden">
                <button type="button" role="menuitem" onClick={openInfo} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--surface-alt)] focus-visible:bg-[var(--surface-alt)] text-right">
                  <InfoIcon /><span>التفاصيل • Info / Details</span>
                </button>
                {canManagePermissions && (
                  <button type="button" role="menuitem" onClick={openShare} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--surface-alt)] focus-visible:bg-[var(--surface-alt)] text-right border-t border-[var(--border-subtle)]">
                    <ShareIcon /><span>المشاركة والصلاحيات • Share / Permissions</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <FileManager
          files={files}
          height="68vh"
          layout="grid"
          enableFilePreview={false}
          permissions={{ create: canCreate, upload: canCreate, move: canUpdate, copy: canCreate, rename: canUpdate, download: true, delete: canDelete }}
          onRefresh={onRefresh}
          onCreateFolder={onCreateFolder}
          onRename={onRename}
          onDelete={onDelete}
          onPaste={onPaste}
          onDownload={onDownload}
          onFileOpen={(file: FileItem) => { const doc = toDoc(file); if (!doc.isDirectory) void openPreview(doc); }}
          onSelectionChange={(items: FileItem[]) => { setSelected(items.length ? toDoc(items[items.length - 1]) : null); setActionMenuOpen(false); }}
          onError={onError}
          fileUploadConfig={{ url: "/api/files", method: "POST" }}
          onFileUploading={onFileUploading}
          onFileUploaded={onFileUploaded}
          primaryColor="#123b70"
        />
      </div>

      {details && (
        <aside className="app-card p-4 md:p-5 xl:sticky xl:top-6" data-testid="details-panel" data-open="true">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-bold text-[var(--primary)]">تفاصيل العنصر</h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-1 rounded-full bg-[var(--surface-alt)] text-[var(--muted)]">{details.isDirectory ? "مجلد" : "ملف"}</span>
              <button type="button" aria-label="إغلاق التفاصيل • Close details" onClick={() => setDetails(null)} className="btn btn-ghost !px-1.5 !py-1"><CloseIcon /></button>
            </div>
          </div>
          <>
            <div className="mb-4"><div className="font-semibold text-[var(--text)] break-words">{details.name}</div><div className="text-xs muted break-all mt-1">{details.path}</div></div>
            <div className="grid grid-cols-3 gap-1 mb-4 bg-[var(--surface-alt)] p-1 rounded-[var(--radius-lg)] text-xs font-medium">
              {(["details", "versions", "permissions"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setPanelTab(t)} className={`py-2 rounded-[var(--radius-md)] transition ${panelTab === t ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"}`}>
                  {t === "details" ? "التفاصيل" : t === "versions" ? "الإصدارات" : "الصلاحيات"}
                </button>
              ))}
            </div>
            {loadingPanel ? (
              <div className="text-sm muted py-8 text-center">جاري التحميل...</div>
            ) : panelTab === "details" ? (
              <div className="space-y-3 text-sm">
                <Info label="النوع" value={details.isDirectory ? "مجلد" : (details.mimeType || extOf(details.name) || "ملف")} />
                <Info label="الحجم" value={details.isDirectory ? "—" : fmtSize(details.size)} />
                <Info label="تم الرفع بواسطة" value={details.uploadedBy || "—"} />
                <Info label="آخر تعديل" value={details.updatedBy || details.uploadedBy || "—"} />
                <Info label="تاريخ التحديث" value={fmtDate(details.updatedAt)} />
                <Info label="الإصدار الحالي" value={details.isDirectory ? "—" : `v${details.currentVersion || 1}`} />
                {!details.isDirectory && <a href={previewUrl(details)} className="btn btn-ghost w-full mt-2">تنزيل الملف</a>}
              </div>
            ) : panelTab === "versions" ? (
              <div className="space-y-2">
                {details.isDirectory ? (
                  <div className="text-sm muted py-6 text-center">الإصدارات متاحة للملفات فقط.</div>
                ) : versions.length ? versions.map((v) => (
                  <div key={v.id} className="p-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-alt)]">
                    <div className="flex items-center justify-between gap-2"><div className="font-medium text-sm text-[var(--text)]">v{v.version} • {v.action}</div><a href={previewUrl(details, v.version)} className="text-xs text-[var(--primary-2)] hover:underline">تنزيل</a></div>
                    <div className="text-[11px] muted mt-1">{v.uploadedBy || "—"}</div>
                    <div className="text-[11px] muted">{fmtDate(v.createdAt)} • {fmtSize(v.size)}</div>
                  </div>
                )) : <div className="text-sm muted py-6 text-center">لا توجد إصدارات بعد.</div>}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs muted bg-[var(--surface-alt)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] p-2">الأدمن (مدير الموارد البشرية) يمنح/يزيل الصلاحيات. الرافع يرى الملف تلقائيًا. Admin grants visibility; uploader auto-access.</div>
                <div className="space-y-2">
                  {perms.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 p-2.5 rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
                      <div className="min-w-0"><div className="text-sm font-medium text-[var(--text)] truncate">{p.user?.name || p.user?.email}</div><div className="text-[11px] muted truncate">{p.user?.role}</div></div>
                      {mayManagePerms && <button type="button" onClick={() => void revokePermission(p.userId)} className="text-xs text-[var(--danger)] hover:bg-red-50 px-2 py-1 rounded-[var(--radius-sm)]">إزالة</button>}
                    </div>
                  ))}
                  {!perms.length && <div className="text-sm muted py-3 text-center">لا توجد صلاحيات خاصة مسجلة.</div>}
                </div>
                {mayManagePerms && (
                  <div className="pt-2 border-t border-[var(--border-subtle)]">
                    <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">منح صلاحية لمستخدم</label>
                    <select className="input text-sm" defaultValue="" onChange={(e) => { if (e.target.value) { void grantPermission(e.target.value); e.target.value = ""; } }}>
                      <option value="">اختر مستخدمًا...</option>
                      {permUsers.filter((u) => !perms.some((p) => p.userId === u.id)).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </>
        </aside>
      )}
    </section>

    {preview && (
      <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
          className="bg-[var(--surface)] rounded-[var(--radius-xl)] w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-2xl border border-[var(--border)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-alt)]">
            <div className="min-w-0"><div id="preview-title" className="font-bold text-[var(--primary)] truncate">{preview.name}</div><div className="text-xs muted truncate">{preview.path} • v{preview.currentVersion || 1} • {preview.uploadedBy ? `رفع بواسطة ${preview.uploadedBy}` : ""}</div></div>
            <div className="flex gap-2 shrink-0"><a href={previewUrl(preview)} className="btn btn-ghost text-sm">تنزيل</a><button ref={previewCloseRef} type="button" onClick={() => setPreview(null)} className="btn btn-ghost text-sm">إغلاق</button></div>
          </div>
          <div className="p-4 md:p-5 overflow-auto max-h-[calc(92vh-72px)] bg-[var(--surface)]">{previewBody}</div>
        </div>
      </div>
    )}
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 py-1 border-b border-[var(--border-subtle)] last:border-0"><span className="muted text-xs">{label}</span><span className="text-[var(--text)] text-xs font-medium text-left break-words">{value}</span></div>;
}
