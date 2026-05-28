import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { getUsers, createUser, updateUser, deleteUser } from '../../api/userManagement'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function avatarColor(name) {
  const c = (name || '?').charCodeAt(0)
  return AVATAR_COLORS[c % AVATAR_COLORS.length]
}

const EMPTY_FORM = { name: '', email: '', role: 'user' }

// ─── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide bg-indigo-600 text-white select-none">
        ADMIN
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide bg-slate-100 text-slate-500 border border-slate-200 select-none">
      USER
    </span>
  )
}

// ─── Kebab menu ───────────────────────────────────────────────────────────────
function ActionMenu({ user, onEdit, onDelete, canDelete = true }) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="w-8 h-8 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        aria-label="Actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className="z-50 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-sm"
        >
          <button
            onClick={() => { onEdit(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            Edit user
          </button>
          {canDelete && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => { onDelete(); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <svg className="w-3.5 h-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Delete user
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}

// ─── Skeleton row (desktop table only) ───────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-200 animate-pulse shrink-0" />
          <div className="h-3.5 bg-slate-200 rounded animate-pulse w-28" />
        </div>
      </td>
      <td className="px-4 py-3.5"><div className="h-3 bg-slate-100 rounded animate-pulse w-44" /></td>
      <td className="px-4 py-3.5"><div className="h-5 bg-slate-100 rounded animate-pulse w-14" /></td>
      <td className="px-4 py-3.5"><div className="h-3 bg-slate-100 rounded animate-pulse w-20" /></td>
      <td className="px-4 py-3.5" />
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers(term) {
    setLoading(true)
    try {
      const res = await getUsers(term)
      setUsers(res.data.users || [])
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await createUser(form)
      setUsers((prev) => [res.data.user, ...prev])
      setForm(EMPTY_FORM)
      setShowAdd(false)
      toast.success('User added')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add user')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(id) {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await updateUser(id, editForm)
      setUsers((prev) => prev.map((u) => u.id === id ? res.data.user : u))
      setEditingId(null)
      toast.success('User updated')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete(user) {
    try {
      await deleteUser(user.id)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      toast.success(`${user.name} deleted`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user')
    } finally {
      setPendingDeleteId(null)
    }
  }

  function startEdit(user) {
    setEditingId(user.id)
    setEditForm({ name: user.name, role: user.role })
    setShowAdd(false)
    setPendingDeleteId(null)
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    fetchUsers(search.trim())
  }

  return (
    <DashboardLayout
      title="Users"
      subtitle={`${users.length} member${users.length !== 1 ? 's' : ''}`}
      actions={
        <button
          onClick={() => { setShowAdd((s) => !s); setEditingId(null); setPendingDeleteId(null) }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-sm hover:from-blue-700 hover:to-indigo-700 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add User
        </button>
      }
    >
      <div className="w-full max-w-5xl space-y-4 overflow-x-hidden">

        {/* ── Add user panel ── */}
        {showAdd && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">New User</h3>
              <button onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Full name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Name"
                    maxLength={80}
                    required
                    autoFocus
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@athivatech.com"
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white transition-colors"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}
                  className="px-3.5 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  {submitting ? 'Adding…' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Search bar ── */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); fetchUsers() } }}
              placeholder="Search by name or email…"
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); fetchUsers() }}
              className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        {/* ── Mobile user cards (< md) ── */}
        <div className="md:hidden flex flex-col gap-3 w-full">

          {loading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-200 rounded w-32" />
                  <div className="h-3 bg-slate-100 rounded w-48" />
                </div>
              </div>
            </div>
          ))}

          {!loading && users.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">No users match the current filters</p>
            </div>
          )}

          {!loading && users.map((user) => (
            <div
              key={user.id}
              className={`bg-white border rounded-xl p-4 shadow-sm transition-colors ${
                editingId === user.id ? 'border-indigo-200 bg-indigo-50/30' :
                pendingDeleteId === user.id ? 'border-red-200 bg-red-50/30' :
                'border-slate-200'
              }`}
            >
              {editingId === user.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    maxLength={80}
                    autoFocus
                    className="w-full rounded-lg border border-indigo-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  />
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                    className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleUpdate(user.id)}
                      disabled={submitting}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors min-h-[36px]"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors min-h-[36px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : pendingDeleteId === user.id ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-red-600 font-medium">Delete {user.name}?</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => confirmDelete(user)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors min-h-[36px]"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setPendingDeleteId(null)}
                      className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors min-h-[36px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 select-none ${avatarColor(user.name)}`}>
                    {(user.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <RoleBadge role={user.role} />
                    <ActionMenu user={user} onEdit={() => startEdit(user)} onDelete={() => setPendingDeleteId(user.id)} canDelete={!user.is_root} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {!loading && users.length > 0 && (
            <p className="text-xs text-slate-400 px-1">
              {users.length} user{users.length !== 1 ? 's' : ''}{search && ' matching search'}
            </p>
          )}
        </div>

        {/* ── Table (md+) ── */}
        <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-56">Name</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-24">Role</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-28">Joined</th>
                  <th className="px-4 py-3.5 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-slate-500">No users match the current filters</p>
                        <p className="text-xs text-slate-400">Try adjusting your search or add a new user above.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className={`group transition-colors duration-75 ${
                        editingId === user.id
                          ? 'bg-indigo-50/40'
                          : pendingDeleteId === user.id
                          ? 'bg-red-50/40'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3.5">
                        {editingId === user.id ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            maxLength={80}
                            autoFocus
                            className="w-full rounded border border-indigo-300 px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                          />
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none ${avatarColor(user.name)}`}>
                              {(user.name || '?')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-slate-900 truncate block leading-snug">{user.name}</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-xs tracking-tight">
                        {user.email}
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5">
                        {editingId === user.id ? (
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                            className="rounded border border-indigo-300 px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        ) : (
                          <RoleBadge role={user.role} />
                        )}
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-3.5 text-xs text-slate-400 tabular-nums">
                        {formatDate(user.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        {editingId === user.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleUpdate(user.id)}
                              disabled={submitting}
                              className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        ) : pendingDeleteId === user.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-red-600 font-medium">Delete?</span>
                            <button
                              onClick={() => confirmDelete(user)}
                              className="px-2 py-1 rounded text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setPendingDeleteId(null)}
                              className="px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                            <ActionMenu
                              user={user}
                              onEdit={() => startEdit(user)}
                              onDelete={() => setPendingDeleteId(user.id)}
                              canDelete={!user.is_root}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && users.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
              <span className="text-xs text-slate-400">
                {users.length} user{users.length !== 1 ? 's' : ''}
                {search && ' matching search'}
              </span>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
