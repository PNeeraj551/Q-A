import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ProfileEditPanel from './ProfileEditPanel'
import Footer from './Footer'
import NotificationBell from './NotificationBell'
import { Button } from '@/components/ui/button'

function SidebarLink({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
            {icon}
          </span>
          {label}
        </>
      )}
    </NavLink>
  )
}

const CalendarIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const ArchiveIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
)

const UsersIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const EventsIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const AnalyticsIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)


export default function DashboardLayout({ children, title, subtitle, actions, resetBadge, onResetClick, onBack }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-60 bg-card border-r border-border flex flex-col shrink-0 fixed inset-y-0 left-0 z-20">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-tight">Q&A Platform</p>
              <p className="text-xs text-muted-foreground leading-tight">AthivaTech</p>
            </div>
          </div>
        </div>

    {/* Navigation */}
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {user?.role === 'admin' ? (
        <>
          <SidebarLink to="/admin/sessions" label="Sessions" icon={CalendarIcon} end />
          <SidebarLink to="/admin/participants" label="Participants" icon={UsersIcon} />
          <SidebarLink to="/admin/archive" label="Archive" icon={ArchiveIcon} />
          <SidebarLink to="/admin/analytics" label="Analytics" icon={AnalyticsIcon} />
        </>
      ) : (
        <>
          <SidebarLink to="/participant/sessions" label="Available Sessions" icon={CalendarIcon} end />
          <SidebarLink to="/participant/events" label="Events" icon={EventsIcon} />
        </>
      )}
    </nav>

        {/* Bottom user section */}
        <div className="px-3 py-4 border-t border-border shrink-0 space-y-1">
          {resetBadge > 0 && (
            <button
              onClick={onResetClick}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors mb-2"
            >
              <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span className="flex-1 text-left text-xs">
                {resetBadge} Password Reset{resetBadge > 1 ? 's' : ''}
              </span>
              <span className="w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center shrink-0">
                {resetBadge}
              </span>
            </button>
          )}

          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors group text-left"
          >
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm select-none shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </button>

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        {/* Top header */}
        {(title || actions) && (
          <header className="bg-card border-b border-border px-8 py-5 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                {onBack && (
                  <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors group"
                  >
                    <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Sessions
                  </button>
                )}
                {title && <h1 className="text-xl font-bold text-foreground">{title}</h1>}
                {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-3">
                {actions && <div className="flex items-center gap-3">{actions}</div>}
                <div className="flex items-center gap-1 ml-1 border-l border-border pl-4">
                  <NotificationBell />
                </div>
              </div>
            </div>
          </header>
        )}

        <main className="flex-1 px-8 py-6 overflow-auto">
          {children}
        </main>
        <Footer />
      </div>

      {profileOpen && <ProfileEditPanel onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
