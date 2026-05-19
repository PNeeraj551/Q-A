import { useCallback, useEffect, useRef, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/common/Button'
import { Label } from '@/components/common/Label'
import { inputCls, errorInputCls } from '@/utils/ui'
import { getUsers, createUser, updateUser, deleteUser } from '../../api/users'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'
import { InlineConfirm } from '@/components/common/InlineConfirm'
import { PageError } from '@/components/common/PageError'
import { EmptyState } from '@/components/common/EmptyState'
import { Skeleton } from '@/components/common/Skeleton'
import { SearchInput } from '@/components/qna/SearchInput'
import { Surface } from '@/components/common/Surface'
import { Stack } from '@/components/common/Stack'
import { Text } from '@/components/common/Text'

const ATHIVA_EMAIL = /^[a-zA-Z0-9._%+-]+@athivatech\.com$/i

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-300/30 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200 text-lg leading-none"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function RoleBadge({ role }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
        Admin
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      User
    </span>
  )
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

function getAvatarColor(name) {
  const initial = name?.[0]?.toUpperCase() || '?'
  const idx = initial.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const deletingRef = useRef(new Set())
  const [fetchError, setFetchError] = useState(false)

  const debouncedSearch = useDebounce(search, 800)

  const load = useCallback(() => {
    setLoading(true)
    setFetchError(false)
    getUsers(debouncedSearch.trim().length >= 1 ? debouncedSearch.trim() : '')
      .then((res) => setUsers(res.data.users || []))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [debouncedSearch])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (deletingRef.current.has(id)) return
    deletingRef.current.add(id)
    try {
      await deleteUser(id)
      setUsers((prev) => prev.filter((u) => u.id !== id))
      toast.success('User deleted.')
    } catch {
      toast.error('Failed to delete user. Please try again.')
    } finally {
      deletingRef.current.delete(id)
      setConfirmDeleteId(null)
    }
  }

  return (
    <DashboardLayout
      title="Users"
      subtitle="Manage user accounts"
      actions={
        <Button onClick={() => setCreateOpen(true)}>
          + Add User
        </Button>
      }
    >
      <div className="max-w-4xl">
        <div className="mb-4">
          <SearchInput
            className="max-w-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
          />
        </div>

        {loading ? (
          <Stack gap={2}>
            {[...Array(4)].map((_, i) => (
              <Surface key={i} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <Stack gap={2}>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </Stack>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-14" />
                  <Skeleton className="h-9 w-16" />
                </div>
              </Surface>
            ))}
          </Stack>
        ) : fetchError ? (
          <PageError heading="Failed to load users" action={{ label: 'Retry', onClick: load }} />
        ) : users.length === 0 ? (
          <EmptyState heading="No users found" description="Try a different search term." />
        ) : (
          <Stack gap={2}>
            {users.map((u) => (
              <Surface key={u.id} className="px-5 py-3.5 flex items-center justify-between gap-4 transition-all duration-200 hover:border-slate-300 hover:shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm select-none shrink-0 ${getAvatarColor(u.name)}`}>
                    {u.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                      <RoleBadge role={u.role} />
                    </div>
                    <Text size="xs" color="muted" className="mt-0.5 truncate">{u.email}</Text>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setEditUser(u)}>
                    Edit
                  </Button>
                  {confirmDeleteId === u.id ? (
                    <InlineConfirm onConfirm={() => handleDelete(u.id)} onCancel={() => setConfirmDeleteId(null)} />
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDeleteId(u.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Surface>
            ))}
          </Stack>
        )}
      </div>

      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          onCreated={(user) => { setUsers((prev) => [user, ...prev]); setCreateOpen(false) }}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onUpdated={(updated) => {
            setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u))
            setEditUser(null)
          }}
        />
      )}

    </DashboardLayout>
  )
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'user' })
  const [errors, setErrors] = useState({})
  const submittingRef = useRef(false)

  function validate() {
    const errs = {}
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    if (!form.email.trim() || !ATHIVA_EMAIL.test(form.email.trim())) errs.email = 'Enter a valid @athivatech.com email'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (submittingRef.current) return
    setErrors({})
    submittingRef.current = true
    try {
      const res = await createUser({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
      })
      onCreated(res.data.user)
      toast.success('User created.')
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Failed to create user.' })
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <Modal title="Add User" onClose={onClose}>
      <Stack as="form" gap={4} onSubmit={handleSubmit}>
        <Stack gap={1.5}>
          <Label className="text-slate-700 font-medium">Name</Label>
          <input
            className={`${inputCls} ${errors.name ? errorInputCls : ''}`}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Full name"
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
        </Stack>
        <Stack gap={1.5}>
          <Label className="text-slate-700 font-medium">Email</Label>
          <input
            type="email"
            className={`${inputCls} ${errors.email ? errorInputCls : ''}`}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="username@athivatech.com"
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
        </Stack>
        <Stack gap={1.5}>
          <Label className="text-slate-700 font-medium">Role</Label>
          <select
            className={inputCls}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </Stack>
        {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" className="flex-1">
            Create User
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </Stack>
    </Modal>
  )
}

function EditUserModal({ user, onClose, onUpdated }) {
  const [name, setName] = useState(user.name)
  const [errors, setErrors] = useState({})
  const submittingRef = useRef(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || name.trim().length < 2) {
      setErrors({ name: 'Name must be at least 2 characters' })
      return
    }
    if (submittingRef.current) return
    setErrors({})
    submittingRef.current = true
    try {
      const res = await updateUser(user.id, { name: name.trim() })
      onUpdated(res.data.user)
      toast.success('User updated.')
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Failed to update user.' })
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <Modal title="Edit User" onClose={onClose}>
      <Stack as="form" gap={4} onSubmit={handleSubmit}>
        <Stack gap={1.5}>
          <Label className="text-slate-700 font-medium">Name</Label>
          <input
            className={`${inputCls} ${errors.name ? errorInputCls : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
        </Stack>
        {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" className="flex-1">
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </Stack>
    </Modal>
  )
}
