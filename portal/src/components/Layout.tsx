import { Outlet, NavLink, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useEffect, useState, type FC } from 'react'
import { clearToken, api } from '../api/client'
import { TopbarProvider, useTopbar } from './TopbarContext'
import { AppProvider, useApp } from '../context/AppContext'
import { AppModal } from './AppModal'
import type { AppSummary } from '../api/client'

// ── Icons ──────────────────────────────────────────────────────────────────
const HomeIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="currentColor">
    <path d="M1 5.5L7.5 1 14 5.5V14H9.5v-3.5h-4V14H1V5.5z" />
  </svg>
)
const GridIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
  </svg>
)
const ChartIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="8" width="3" height="6" rx="0.5" />
    <rect x="6" y="5" width="3" height="9" rx="0.5" />
    <rect x="11" y="2" width="3" height="12" rx="0.5" />
  </svg>
)
const CogIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="7.5" cy="7.5" r="2" />
    <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14" strokeLinecap="round" />
    <path d="M3.2 3.2l1.06 1.06M10.74 10.74l1.06 1.06M3.2 11.8l1.06-1.06M10.74 4.26l1.06-1.06" strokeLinecap="round" />
  </svg>
)
const PersonIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="7.5" cy="4" r="2.5" />
    <path d="M1.5 14c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" strokeLinecap="round" />
  </svg>
)
const AppsIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
  </svg>
)
const DocIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="1" width="13" height="13" rx="1.5" />
    <line x1="4" y1="5" x2="11" y2="5" strokeLinecap="round" />
    <line x1="4" y1="7.5" x2="11" y2="7.5" strokeLinecap="round" />
    <line x1="4" y1="10" x2="8" y2="10" strokeLinecap="round" />
  </svg>
)
const ChevronIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3.5 5.5l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const ClockIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="7.5" cy="7.5" r="6" />
    <path d="M7.5 4v3.5l2.5 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PAGE_LABELS: Record<string, string> = {
  '/': 'SDK Docs',
  '/apps': 'Apps',
  '/account': 'Account',
  'dashboard': 'Dashboard',
  'features':  'Features',
  'transitions': 'Transitions',
  'analytics': 'Analytics',
  'settings':  'Settings',
}

function NavItem({
  to, label, Icon, badgeCount = 0, badgeColor = 'red', disabled = false, end = false,
}: {
  to: string; label: string; Icon: FC<{ className?: string }>
  badgeCount?: number; badgeColor?: 'red' | 'amber'; disabled?: boolean; end?: boolean
}) {
  if (disabled) {
    return (
      <div
        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-px text-slate-300 cursor-not-allowed font-medium"
        style={{ fontSize: 13.5 }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {label}
      </div>
    )
  }
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-px no-underline transition-colors ${
          isActive
            ? 'bg-indigo-50 text-indigo-600 font-semibold'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
        }`
      }
      style={{ fontSize: 13.5 }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
      {badgeCount > 0 && (
        <span
          className={`ml-auto font-bold rounded-full px-1.5 py-px ${
            badgeColor === 'red' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
          }`}
          style={{ fontSize: 10 }}
        >
          {badgeCount}
        </span>
      )}
    </NavLink>
  )
}

function AppSwitcher() {
  const nav = useNavigate()
  const { appId } = useParams<{ appId?: string }>()
  const { apps, activeApp, reloadApps } = useApp()
  const [open, setOpen]           = useState(false)
  const [showModal, setShowModal] = useState(false)

  function handleCreated(app: AppSummary) {
    setShowModal(false)
    reloadApps()
    nav(`/apps/${app.id}/dashboard`)
  }

  return (
    <div className="relative mb-2.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 hover:border-indigo-400 transition-colors flex items-center justify-between"
        style={{ padding: '10px 12px' }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-slate-900 font-bold truncate" style={{ fontSize: 13 }}>
            {activeApp?.name ?? (appId ? 'Loading…' : 'Select App')}
          </div>
          <div className="font-mono text-slate-400 mt-0.5 truncate" style={{ fontSize: 11 }}>
            {activeApp?.packageName ?? ''}
          </div>
        </div>
        <ChevronIcon className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
            <div className="max-h-48 overflow-y-auto">
              {apps.length === 0 && (
                <p className="text-slate-400 text-center py-4" style={{ fontSize: 12 }}>No apps yet</p>
              )}
              {apps.map(app => (
                <button
                  key={app.id}
                  onClick={() => { setOpen(false); nav(`/apps/${app.id}/dashboard`) }}
                  className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                    app.id === appId ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-900 font-semibold truncate" style={{ fontSize: 13 }}>{app.name}</div>
                    <div className="font-mono text-slate-400 truncate" style={{ fontSize: 11 }}>{app.packageName}</div>
                  </div>
                  {app.id === appId && <span className="text-indigo-600 text-xs">✓</span>}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100">
              <button
                onClick={() => { setOpen(false); setShowModal(true) }}
                className="w-full text-left px-3 py-2.5 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors"
                style={{ fontSize: 13 }}
              >
                + New App
              </button>
            </div>
          </div>
        </>
      )}

      {showModal && <AppModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </div>
  )
}

function Topbar({ lastSynced }: { lastSynced: Date | null }) {
  const location = useLocation()
  const { appId } = useParams<{ appId?: string }>()
  const { activeApp } = useApp()
  const { actions } = useTopbar()
  const [, forceRender] = useState(0)

  useEffect(() => {
    if (!lastSynced) return
    const id = setInterval(() => forceRender(n => n + 1), 60_000)
    return () => clearInterval(id)
  }, [lastSynced])

  function relativeTime(d: Date): string {
    const mins = Math.floor((Date.now() - d.getTime()) / 60_000)
    if (mins < 1) return 'just now'
    if (mins === 1) return '1 min ago'
    return `${mins} min ago`
  }

  const segments = location.pathname.split('/').filter(Boolean)
  const lastSegment = segments[segments.length - 1]
  const pageLabel = PAGE_LABELS[location.pathname] ?? PAGE_LABELS[lastSegment] ?? 'Detail'

  const ANALYTICS_PAGES = new Set(['dashboard', 'features', 'transitions', 'analytics'])
  const showSynced = lastSynced && segments.length === 3 && ANALYTICS_PAGES.has(segments[2])

  // suppress unused warning — appId drives activeApp via AppContext
  void appId

  return (
    <div
      className="flex items-center bg-white border-b border-slate-200 flex-shrink-0 gap-3 px-7"
      style={{ height: 54 }}
    >
      {activeApp && (
        <>
          <span className="text-slate-400" style={{ fontSize: 13 }}>{activeApp.name}</span>
          <span className="text-slate-300" style={{ fontSize: 13 }}>/</span>
        </>
      )}
      <span className="text-slate-700 font-semibold" style={{ fontSize: 13 }}>{pageLabel}</span>
      <div className="ml-auto flex items-center gap-2.5">
        {showSynced && (
          <div
            className="flex items-center gap-1.5 bg-green-100 text-green-600 font-medium rounded-full px-3 py-1"
            style={{ fontSize: 12 }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-600 animate-breathe" />
            Synced {relativeTime(lastSynced)}
          </div>
        )}
        {actions}
      </div>
    </div>
  )
}

function Sidebar({ deadCount }: { deadCount: number }) {
  const nav = useNavigate()
  const { appId } = useParams<{ appId?: string }>()
  const email    = localStorage.getItem('fp_email') ?? ''
  const initials = email.slice(0, 2).toUpperCase() || 'FP'
  const effectiveAppId = appId ?? localStorage.getItem('fp_last_app_id') ?? null
  const hasApp = !!effectiveAppId

  return (
    <aside
      className="flex flex-col bg-white flex-shrink-0"
      style={{ width: 252, height: '100vh', borderRight: '1px solid #E2E8F0' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 border-b border-slate-100" style={{ paddingTop: 18, paddingBottom: 16 }}>
        <div
          className="flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ width: 32, height: 32, borderRadius: 9 }}
        >
          <img src="/icon.png" alt="FeaturePulse" style={{ width: 32, height: 32, objectFit: 'cover' }} />
        </div>
        <span className="text-slate-900 font-extrabold" style={{ fontSize: 15, letterSpacing: '-0.3px' }}>
          FeaturePulse
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <p className="uppercase text-slate-400 font-bold px-2 mb-1" style={{ fontSize: 10, letterSpacing: '0.09em', marginTop: 4 }}>
          Analytics
        </p>
        <NavItem to={hasApp ? `/apps/${effectiveAppId}/dashboard` : '#'} label="Dashboard" Icon={HomeIcon} disabled={!hasApp} />
        <NavItem to={hasApp ? `/apps/${effectiveAppId}/features` : '#'}  label="Features"  Icon={GridIcon}  badgeCount={hasApp ? deadCount : 0} badgeColor="red" disabled={!hasApp} />
        <NavItem to={hasApp ? `/apps/${effectiveAppId}/transitions` : '#'} label="Transitions" Icon={ClockIcon} disabled={!hasApp} />
        <NavItem to={hasApp ? `/apps/${effectiveAppId}/analytics` : '#'} label="Analytics" Icon={ChartIcon} disabled={!hasApp} />

        <div className="my-1" style={{ height: 1, background: '#F1F5F9', margin: '4px 0' }} />

        <p className="uppercase text-slate-400 font-bold px-2 mb-1 mt-3" style={{ fontSize: 10, letterSpacing: '0.09em' }}>
          App
        </p>
        <NavItem to={hasApp ? `/apps/${effectiveAppId}/settings` : '#'} label="Settings" Icon={CogIcon} disabled={!hasApp} />

        <div className="my-1" style={{ height: 1, background: '#F1F5F9', margin: '4px 0' }} />

        <p className="uppercase text-slate-400 font-bold px-2 mb-1 mt-3" style={{ fontSize: 10, letterSpacing: '0.09em' }}>
          Global
        </p>
        <NavItem to="/apps"    label="Apps"    Icon={AppsIcon} end />
        <NavItem to="/account" label="Account" Icon={PersonIcon} />
        <NavItem to="/"        label="SDK Docs" Icon={DocIcon} end />
      </nav>

      {/* Footer — App Switcher + user info */}
      <div className="px-2.5 py-3 border-t border-slate-100">
        <AppSwitcher />
        <div className="flex items-center gap-2 px-0.5">
          <div
            className="flex-shrink-0 flex items-center justify-center bg-indigo-50 text-indigo-600 font-extrabold rounded-full"
            style={{ width: 28, height: 28, fontSize: 10 }}
          >
            {initials}
          </div>
          <span className="flex-1 text-slate-500 truncate" style={{ fontSize: 11.5 }}>{email}</span>
          <button
            onClick={() => { clearToken(); nav('/login') }}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            style={{ fontSize: 11, padding: '3px 7px' }}
          >
            Log out
          </button>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100">
          <a href="/privacy" className="text-xs text-gray-500 hover:underline">Privacy Policy</a>
        </div>
      </div>
    </aside>
  )
}

function LayoutInner() {
  const { appId } = useParams<{ appId?: string }>()
  const [deadCount,  setDeadCount]  = useState(0)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)

  useEffect(() => {
    if (!appId) return
    api.getDashboard(appId)
      .then((d) => {
        setDeadCount(d.counts['DEAD'] ?? 0)
        setLastSynced(new Date())
      })
      .catch(() => {})
  }, [appId])

  return (
    <div className="flex font-sans" style={{ height: '100vh', overflow: 'hidden', background: '#F8FAFC' }}>
      <Sidebar deadCount={deadCount} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar lastSynced={lastSynced} />
        <main className="flex-1 overflow-y-auto" style={{ padding: '26px 28px 40px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function Layout() {
  return (
    <TopbarProvider>
      <AppProvider>
        <LayoutInner />
      </AppProvider>
    </TopbarProvider>
  )
}
