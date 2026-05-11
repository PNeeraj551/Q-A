import { useEffect, useRef, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { inputCls, errorInputCls } from '@/lib/ui'
import { getUsers, createUser, updateUser, deleteUser, resetUserPassword } from '../../api/users'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [tempPassword, setTempPassword] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const deletingRef = useRef(new Set())
  const resetRef = useRef(new Set())
  const [fetchError, setFetchError] = useState(false)

  const debouncedSearch = useDebounce(search, 400)

  useEffect(() => {
    setLoading(true)
    setFetchError(false)
    getUsers(debouncedSearch.trim().length >= 3 ? debouncedSearch.trim() : '')
      .then((res) => setUsers(res.data.users || []))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [debouncedSearch])

  async function handleDelete(id) {
    if (deletingRef.current.has(id)) return
    deletingRef.current.add(id)
    try {
      await deleteUser(id)
      setUsers((prev) => prev.filter((u) => u._id !== id))
      toast.success('User deleted.')
    } catch {
      toast.error('Failed to delete user. Please try again.')
    } finally {
      deletingRef.current.delete(id)
      setConfirmDeleteId(null)
    }
  }

  async function handleResetPassword(id) {
    if (resetRef.current.has(id)) return
    resetRef.current.add(id)
    try {
      const res = await resetUserPassword(id)
      setTempPassword(res.data.temporaryPassword)
    } catch { /* ignore */ } finally {
      resetRef.current.delete(id)
    }
  }

  return (
    <DashboardLayout
      title="Users"
      subtitle="Manage participant accounts"
      actions={<Button onClick={() => setCreateOpen(true)}>+ Add User</Button>}
    >
      <div className="max-w-3xl">
        <div className="mb-4">
          <input
            className={`${inputCls} max-w-xs`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-32" />
                  <div className="h-3 bg-muted rounded animate-pulse w-48" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-14 bg-muted rounded-md animate-pulse" />
                  <div className="h-8 w-16 bg-muted rounded-md animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">Failed to load users</p>
            <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No users found.</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u._id} className="bg-card border border-border rounded-xl px-5 py-3.5 flex items-center justify-between gap-4 transition-colors hover:border-border/70">
                <div>
                  <p className="text-sm font-medium text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {u.email} <span className="mx-1">·</span> <span className="capitalize">{u.role}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">

                  <Button size="sm" onClick={() => setEditUser(u)}>
                    Edit
                  </Button>
                  {confirmDeleteId === u._id ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(u._id)}
                      >
                        Confirm
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDeleteId(u._id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
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
            setUsers((prev) => prev.map((u) => u._id === updated._id ? updated : u))
            setEditUser(null)
          }}
        />
      )}

      {tempPassword && (
        <Modal title="Temporary Password" onClose={() => setTempPassword(null)}>
          <p className="text-sm text-muted-foreground mb-3">
            Share this temporary password with the participant. They will be prompted to change it on next login.
          </p>
          <div className="bg-muted rounded-md px-4 py-3 font-mono text-foreground text-center text-lg tracking-widest select-all border border-border">
            {tempPassword}
          </div>
          <Button className="w-full mt-4" onClick={() => setTempPassword(null)}>Done</Button>
        </Modal>
      )}
    </DashboardLayout>
  )
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'participant' })
  const [errors, setErrors] = useState({})
  const submittingRef = useRef(false)

  function validate() {
    const errs = {}
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    if (!form.email.trim() || !EMAIL_RE.test(form.email.trim())) errs.email = 'Valid email required'
    if (!form.password || form.password.length < 6) errs.password = 'Password must be at least 6 characters'
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
        password: form.password,
        role: form.role,
      })
      onCreated(res.data.user)
      toast.success('User created successfully.')
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Failed to create user.' })
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <Modal title="Add User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <input
            className={`${inputCls} ${errors.name ? errorInputCls : ''}`}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Full name"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <input
            type="email"
            className={`${inputCls} ${errors.email ? errorInputCls : ''}`}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@company.com"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Password</Label>
          <input
            type="password"
            className={`${inputCls} ${errors.password ? errorInputCls : ''}`}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Minimum 6 characters"
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <select
            className={inputCls}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="participant">Participant</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {errors.submit && <p className="text-sm text-destructive">{errors.submit}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" className="flex-1">
            Create User
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal({ user, onClose, onUpdated }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [errors, setErrors] = useState({})
  const submittingRef = useRef(false)

  function validate() {
    const errs = {}
    if (!name.trim() || name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    if (!email.trim() || !EMAIL_RE.test(email.trim())) errs.email = 'Valid email required'
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
      const res = await updateUser(user._id, { name: name.trim(), email: email.trim().toLowerCase() })
      onUpdated(res.data.user)
      toast.success('User updated successfully.')
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Failed to update user.' })
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <Modal title="Edit User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <input
            className={`${inputCls} ${errors.name ? errorInputCls : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <input
            type="email"
            className={`${inputCls} ${errors.email ? errorInputCls : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
        {errors.submit && <p className="text-sm text-destructive">{errors.submit}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" className="flex-1">
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}
