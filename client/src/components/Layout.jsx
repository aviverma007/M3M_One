import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, Building2, Users, ShieldCheck, ScrollText, LogOut, Menu, X, ChevronsUpDown, CheckCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { get, put } from '../lib/api';
import { PORTFOLIOS, isAdmin, roleLabel, deptLabel } from '../lib/constants';

export const PORTFOLIO_KEY = 'm3m_one_portfolio';
export const getPortfolio = () => localStorage.getItem(PORTFOLIO_KEY) || '';

function Notifications() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const ref = useRef(null);
  const load = () => get('/notifications', { limit: 15 }).then((d) => setRows(d.rows || [])).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const unread = rows.filter((r) => !r.isRead).length;
  const markAll = async () => { await put('/notifications/mark-all-read'); setRows((r) => r.map((x) => ({ ...x, isRead: true }))); };
  const markOne = async (n) => { if (n.isRead) return; await put(`/notifications/${n.id}/read`); setRows((r) => r.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))); };
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn-ghost relative p-2" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-80 overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && <button type="button" className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline" onClick={markAll}><CheckCheck className="h-3.5 w-3.5" />Mark all read</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-500">You're all caught up.</p>}
            {rows.map((n) => (
              <button type="button" key={n.id} onClick={() => markOne(n)} className={`block w-full border-b border-ink-50 px-4 py-3 text-left hover:bg-ink-50 ${n.isRead ? '' : 'bg-brand-50/50'}`}>
                <p className={`text-sm ${n.isRead ? 'text-ink-600' : 'font-medium text-ink-900'}`}>{n.message}</p>
                <p className="mt-0.5 text-xs text-ink-400">{new Date(n.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioSwitch() {
  const [value, setValue] = useState(getPortfolio());
  const change = (v) => {
    setValue(v);
    if (v) localStorage.setItem(PORTFOLIO_KEY, v); else localStorage.removeItem(PORTFOLIO_KEY);
    window.dispatchEvent(new Event('m3m:portfolio'));
  };
  return (
    <label className="relative block">
      <span className="mb-1 block px-1 text-[10px] font-semibold uppercase tracking-wider text-brand-200">Portfolio</span>
      <select value={value} onChange={(e) => change(e.target.value)} className="w-full appearance-none rounded-lg border-0 bg-brand-900/60 py-2 pl-3 pr-8 text-sm text-white ring-1 ring-brand-700 focus:ring-brand-400">
        <option value="">All portfolios</option>
        {PORTFOLIOS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute bottom-2.5 right-2.5 h-4 w-4 text-brand-200" />
    </label>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const admin = isAdmin(user);
  const nav = [
    { to: '/projects', label: 'Projects', icon: Building2 },
    ...(admin ? [
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/access', label: 'Module access', icon: ShieldCheck },
      { to: '/admin/audit', label: 'Activity log', icon: ScrollText },
    ] : []),
  ];
  const sidebar = (
    <div className="flex h-full flex-col bg-brand-950 px-4 py-5 text-brand-50">
      <div className="mb-8 flex items-center gap-2.5 px-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold">M1</div>
        <div>
          <p className="text-sm font-semibold leading-tight">M3M One</p>
          <p className="text-[11px] text-brand-300">Project governance</p>
        </div>
      </div>
      <PortfolioSwitch />
      <nav className="mt-6 space-y-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={() => setMobile(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand-800 text-white' : 'text-brand-200 hover:bg-brand-900 hover:text-white'}`}>
            <Icon className="h-4 w-4" />{label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto rounded-lg bg-brand-900/60 p-3">
        <p className="truncate text-sm font-medium">{user?.name || user?.email}</p>
        <p className="truncate text-xs text-brand-300">{roleLabel(user?.role)} · {deptLabel(user?.department)}</p>
        <button type="button" onClick={() => { logout(); navigate('/login'); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-brand-800 py-1.5 text-xs font-medium text-brand-100 hover:bg-brand-700">
          <LogOut className="h-3.5 w-3.5" />Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setMobile(false)} />
          <div className="relative h-full w-64">{sidebar}</div>
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-200/70 bg-white/80 px-4 backdrop-blur lg:px-8">
        <button type="button" className="btn-ghost p-2 lg:hidden" onClick={() => setMobile(true)} aria-label="Menu">{mobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        <div className="flex-1" />
        <Notifications />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8"><Outlet /></main>
    </div>
  );
}
