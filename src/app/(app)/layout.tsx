"use client";
// تخطيط التطبيق المحمي - Protected app shell
// شريط جانبي قابل للتصغير + فحص جلسة - collapsible sidebar + session guard

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import "./shell.css";

const COLLAPSED_KEY = "hrms.sidebar.collapsed";

const nav = [
  { href: "/dashboard", label: "لوحة التحكم", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/attendance", label: "الحضور والانصراف", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/employees", label: "الموظفون", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { href: "/leaves", label: "الإجازات", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/documents", label: "إدارة الملفات", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
];

function getErrorMessage(data: any, fallback: string) { if (!data) return fallback; if (typeof data.error === 'string') return data.error; if (data.error?.message) return data.error.message; return fallback; }

// حالة التصغير محفوظة محليًا - collapse state persisted in localStorage
function readCollapsed(): boolean {
  try { return window.localStorage.getItem(COLLAPSED_KEY) === "true"; }
  catch { return false; }
}
function writeCollapsed(value: boolean): void {
  try { window.localStorage.setItem(COLLAPSED_KEY, String(value)); }
  catch { return; }
}

// روابط التنقل - pure nav list; pathname is passed in so the same markup can
// serve as the Suspense fallback (empty pathname => no active link).
type NavListProps = {
  isCollapsed: boolean;
  isMobile: boolean;
  onNavigate: () => void;
};

function NavList({ pathname, isCollapsed, isMobile, onNavigate }: NavListProps & { pathname: string }) {
  return (
    <nav id={isMobile ? 'app-mobile-nav' : 'app-sidebar-nav'} className="app-nav" aria-label="التنقل الرئيسي / Primary navigation">
      {nav.map((i) => {
        const active = pathname === i.href || pathname.startsWith(i.href + '/');
        return (
          <Link key={i.href} href={i.href} onClick={onNavigate}
            className="app-nav-link" data-active={active ? 'true' : 'false'}
            aria-label={isCollapsed ? i.label : undefined}
            aria-current={active ? 'page' : undefined}
            title={isCollapsed ? i.label : undefined}>
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={i.icon}/></svg>
            <span className="app-nav-label">{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// قراءة المسار الحالي - reads the URL; suspends on routes with unknown dynamic
// params, so it must live behind a Suspense boundary (per Next.js docs).
function ActiveNavList(props: NavListProps) {
  const pathname = usePathname();
  return <NavList pathname={pathname} {...props} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authError, setAuthError] = useState('');
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setCollapsed(readCollapsed()); }, []);

  useEffect(() => {
    fetch('/api/auth/me').then(async (r) => {
      const d = await r.json().catch(() => null);
      if (!r.ok) { setAuthError(getErrorMessage(d, 'يرجى تسجيل الدخول - please login')); router.replace('/'); return; }
      setUser(d.user);
    }).catch(() => { setAuthError('فشل التحقق من الجلسة - session check failed'); router.replace('/'); });
  }, [router]);

  // إدارة تركيز درج الجوال - mobile drawer focus management
  useEffect(() => {
    if (!open) return;
    drawerCloseRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); mobileToggleRef.current?.focus(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null); router.replace('/'); }

  function toggleCollapsed() {
    setCollapsed((prev) => { const next = !prev; writeCollapsed(next); return next; });
  }

  function renderSidebar(isCollapsed: boolean, isMobile: boolean) {
    return (
      <aside className={`app-sidebar${isCollapsed ? ' app-sidebar--collapsed' : ''}`} data-collapsed={isCollapsed ? 'true' : 'false'} aria-label="القائمة الرئيسية / Main navigation">
        <div className="app-sidebar-top">
          {isMobile ? (
            <button ref={drawerCloseRef} type="button" className="app-icon-button" onClick={() => setOpen(false)} aria-label="إغلاق القائمة / Close menu" data-testid="drawer-close">
              <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          ) : (
            <button type="button" className="app-icon-button" onClick={toggleCollapsed} aria-label={isCollapsed ? 'توسيع الشريط الجانبي / Expand sidebar' : 'تصغير الشريط الجانبي / Collapse sidebar'} aria-expanded={!isCollapsed} aria-controls="app-sidebar-nav" title={isCollapsed ? 'توسيع / Expand' : 'تصغير / Collapse'} data-testid="sidebar-toggle">
              <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v14H4zM9 5v14"/></svg>
            </button>
          )}
        </div>
        <Suspense fallback={<NavList pathname="" isCollapsed={isCollapsed} isMobile={isMobile} onNavigate={() => setOpen(false)} />}>
          <ActiveNavList isCollapsed={isCollapsed} isMobile={isMobile} onNavigate={() => setOpen(false)} />
        </Suspense>
        <div className="app-sidebar-footer">
          {user?.name && <div className="app-user-name" title={user.name}>{user.name}</div>}
          {authError && <div className="app-auth-error">{authError}</div>}
          <Link href="/change-password" className="app-logout" aria-label="تغيير كلمة المرور / Change password" title="تغيير كلمة المرور / Change password">
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            <span className="app-nav-label">تغيير كلمة المرور</span>
          </Link>
          <button type="button" onClick={logout} className="app-logout" aria-label="تسجيل الخروج / Logout" title="تسجيل الخروج / Logout">
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            <span className="app-nav-label">تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    );
  }

  return (
    <div className="app-shell" data-collapsed={collapsed ? 'true' : 'false'}>
      <div className="app-desktop-sidebar">{renderSidebar(collapsed, false)}</div>
      <div className="app-mobile-header">
        <button ref={mobileToggleRef} type="button" onClick={() => setOpen(!open)} className="app-icon-button" aria-label={open ? 'إغلاق القائمة / Close menu' : 'فتح القائمة / Open menu'} aria-expanded={open} aria-controls="app-mobile-drawer" data-testid="mobile-menu-toggle">
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>
      {open && (
        <div className="app-drawer" id="app-mobile-drawer" data-testid="mobile-drawer">
          <div className="app-drawer-scrim" onClick={() => setOpen(false)} />
          <div className="app-drawer-panel">{renderSidebar(false, true)}</div>
        </div>
      )}
      <main className="p-4 md:p-7 lg:p-8 min-w-0">
        {/* Dynamic-param pages (e.g. /leaves/[id]) suspend on params during prerender. */}
        <Suspense fallback={null}>{children}</Suspense>
      </main>
    </div>
  );
}
