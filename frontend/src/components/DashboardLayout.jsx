import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ProfileEditPanel from './ProfileEditPanel'
import Footer from './Footer'
import { Button } from '@/components/ui/button'

function SidebarLink({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`w-4 h-4 shrink-0 ${isActive ? 'opacity-90' : 'opacity-60'}`}>
            {icon}
          </span>
          {label}
        </>
      )}
    </NavLink>
  )
}

const QnaIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

const UsersIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const AnalyticsIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

export default function DashboardLayout({ children, title, subtitle, actions, onBack, bottomBar }) {
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
      <aside className="w-56 bg-sidebar border-r border-border flex flex-col shrink-0 fixed inset-y-0 left-0 z-20">
        {/* Brand */}
        <div className="px-4 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">Q&A Platform</p>
              <p className="text-xs text-muted-foreground leading-tight">AthivaTech</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {user?.role === 'admin' ? (
            <>
              <SidebarLink to="/admin/qna" label="Q&A" icon={QnaIcon} end />
              <SidebarLink to="/admin/users" label="Users" icon={UsersIcon} />
              <SidebarLink to="/admin/analytics" label="Analytics" icon={AnalyticsIcon} />
            </>
          ) : (
            <SidebarLink to="/user/qna" label="Q&A Boards" icon={QnaIcon} end />
          )}
        </nav>

        {/* User section */}
        <div className="px-2 py-3 border-t border-border shrink-0 space-y-0.5">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs select-none shrink-0">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate leading-tight">{user?.name || ''}</p>
              <p className="text-xs text-muted-foreground capitalize leading-tight">{user?.role}</p>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-56 flex flex-col min-h-screen">
        {(title || actions) && (
          <header className="bg-card border-b border-border px-8 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                {onBack && (
                  <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1.5 transition-colors group"
                  >
                    <svg className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                )}
                {title && <h1 className="text-lg font-semibold text-foreground">{title}</h1>}
                {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
          </header>
        )}

        <main className="flex-1 px-8 py-6 overflow-auto">
          {children}
        </main>

        {bottomBar && (
          <div className="shrink-0 border-t border-border bg-card px-8 py-3">
            {bottomBar}
          </div>
        )}

        <Footer />
      </div>

      {profileOpen && <ProfileEditPanel onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
