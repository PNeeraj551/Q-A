import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import ProfileEditPanel from '../users/ProfileEditPanel'

function SidebarLink({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`w-[18px] h-[18px] shrink-0 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-75'}`}>
            {icon}
          </span>
          <span>{label}</span>
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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200/80 flex flex-col shrink-0 fixed inset-y-0 left-0 z-20 shadow-sm">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.25" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight tracking-tight">Q&A Platform</p>
              <p className="text-xs text-slate-500 leading-tight font-medium">AthivaTech</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {user?.role === 'admin' ? (
            <>
              <p className="px-3 pt-1 pb-2.5 text-xs font-semibold tracking-wider text-slate-400">
                Navigation
              </p>
              <SidebarLink to="/admin/qna" label="Q&A Boards" icon={QnaIcon} />
              <SidebarLink to="/admin/users" label="Users" icon={UsersIcon} />
              <SidebarLink to="/admin/analytics" label="Analytics" icon={AnalyticsIcon} />
            </>
          ) : (
            <>
              <p className="px-3 pt-1 pb-2.5 text-xs font-semibold tracking-wider text-slate-400">
                Navigation
              </p>
              <SidebarLink to="/user/qna" label="Q&A Boards" icon={QnaIcon} />
            </>
          )}
        </nav>

        {/* User section */}
        <div className="px-3 py-3 border-t border-slate-100 shrink-0 space-y-1">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all duration-200 text-left group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs select-none shrink-0 shadow-sm ring-2 ring-blue-100">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{user?.name || ''}</p>
              <p className="text-xs text-slate-500 capitalize leading-tight font-medium">{user?.role}</p>
            </div>
            <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        {(title || actions) && (
          <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-8 py-5 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-700 mb-2.5 transition-colors duration-200 group"
                  >
                    <svg className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform duration-200" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                )}
                {title && <h1 className="text-xl font-bold text-slate-900 leading-tight tracking-tight">{title}</h1>}
                {subtitle && <p className="text-sm text-slate-500 mt-1 leading-relaxed">{subtitle}</p>}
              </div>
              {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
            </div>
          </header>
        )}

        <main className="flex-1 px-8 py-8 overflow-auto">
          {children}
        </main>

        {bottomBar && (
          <div className="shrink-0 border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-8 py-4">
            {bottomBar}
          </div>
        )}
      </div>

      {profileOpen && <ProfileEditPanel onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
