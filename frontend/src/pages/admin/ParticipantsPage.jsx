import { useEffect, useState, useCallback, useRef } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { getUsers, createUser, deactivateUser, updateUser } from '../../api/users'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  // Remove/Deactivate state
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError, setRemoveError] = useState('')

  // Add state
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '' })
  const [addErrors, setAddErrors] = useState({})
  const [addServerError, setAddServerError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Edit state
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', is_active: true })
  const [editErrors, setEditErrors] = useState({})
  const [editServerError, setEditServerError] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const fetchParticipants = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getUsers(debouncedSearch)
      const all = (res.data.users || []).filter(u => u.role === 'participant')
      setParticipants(all)
    } catch (err) {
      setError('Failed to load participants.')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => { fetchParticipants() }, [fetchParticipants])

  const visible = showInactive
    ? participants
    : participants.filter(p => p.is_active)

  async function handleRemove() {
    if (!removeTarget) return
    setRemoveLoading(true)
    setRemoveError('')
    try {
      await deactivateUser(removeTarget._id)
      setRemoveTarget(null)
      fetchParticipants()
    } catch (err) {
      setRemoveError(err.response?.data?.error || err.response?.data?.message || 'Failed to deactivate.')
    } finally {
      setRemoveLoading(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setAddServerError('')
    const errs = {}
    if (!addForm.name.trim()) errs.name = 'Required'
    if (!addForm.email.trim()) errs.email = 'Required'
    if (!addForm.password) errs.password = 'Required'
    if (Object.keys(errs).length) { setAddErrors(errs); return }

    setAddLoading(true)
    try {
      await createUser({ ...addForm, role: 'participant' })
      setAddOpen(false)
      setAddForm({ name: '', email: '', password: '' })
      fetchParticipants()
    } catch (err) {
      setAddServerError(err.response?.data?.message || 'Failed to create.')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleEdit(e) {
    e.preventDefault()
    setEditServerError('')
    setEditLoading(true)
    try {
      await updateUser(editTarget._id, editForm)
      setEditTarget(null)
      fetchParticipants()
    } catch (err) {
      setEditServerError(err.response?.data?.message || 'Failed to update.')
    } finally {
      setEditLoading(false)
    }
  }

  const activeCount = participants.filter(p => p.is_active).length
  const inactiveCount = participants.filter(p => !p.is_active).length

  const addAction = (
    <Button
      onClick={() => setAddOpen(true)}
      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      Add Participant
    </Button>
  )

  return (
    <DashboardLayout
      title="Participants"
      subtitle={`${activeCount} active · ${inactiveCount} inactive`}
      actions={addAction}
    >
      {/* Search Bar */}
      <div className="bg-card rounded-2xl border border-border shadow-sm mb-6 p-4 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search participants..."
            className="pl-9 h-10 rounded-xl"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showInactive ? 'secondary' : 'outline'}
            onClick={() => setShowInactive(!showInactive)}
            className="rounded-xl"
          >
            {showInactive ? 'Hide Inactive' : 'Show Inactive'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20">{error}</div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden divide-y divide-border">
          {visible.length === 0 ? (
            <div className="p-20 text-center text-slate-500">No participants found.</div>
          ) : (
            visible.map(p => (
              <div key={p._id} className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {p.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditTarget(p)
                      setEditForm({ name: p.name, email: p.email, is_active: p.is_active })
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </Button>
                  {p.is_active && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRemoveTarget(p)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {addOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h2 className="text-lg font-bold mb-4">Add Participant</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              {addServerError && <div className="p-2 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20">{addServerError}</div>}
              <Input
                placeholder="Full Name"
                value={addForm.name}
                onChange={e => setAddForm({...addForm, name: e.target.value})}
              />
              <Input
                placeholder="Email Address"
                value={addForm.email}
                onChange={e => setAddForm({...addForm, email: e.target.value})}
              />
              <Input
                placeholder="Temporary Password"
                type="text"
                value={addForm.password}
                onChange={e => setAddForm({...addForm, password: e.target.value})}
              />
              <div className="flex gap-3 pt-2">
                <Button variant="outline" type="button" onClick={() => setAddOpen(false)} className="flex-1">Cancel</Button>
                <Button type="submit" disabled={addLoading} className="flex-1 bg-primary text-primary-foreground">
                  {addLoading ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h2 className="text-lg font-bold mb-4">Edit Participant</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              {editServerError && <div className="p-2 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20">{editServerError}</div>}
              <Input
                placeholder="Full Name"
                value={editForm.name}
                onChange={e => setEditForm({...editForm, name: e.target.value})}
              />
              <Input
                placeholder="Email Address"
                value={editForm.email}
                onChange={e => setEditForm({...editForm, email: e.target.value})}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={e => setEditForm({...editForm, is_active: e.target.checked})}
                  className="rounded"
                />
                <span className="text-sm">Account Active</span>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" type="button" onClick={() => setEditTarget(null)} className="flex-1">Cancel</Button>
                <Button type="submit" disabled={editLoading} className="flex-1 bg-primary text-primary-foreground">
                  {editLoading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold mb-2">Deactivate?</h3>
            <p className="text-sm text-slate-500 mb-6">This will disable {removeTarget.name}'s access.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setRemoveTarget(null)} className="flex-1">Cancel</Button>
              <Button onClick={handleRemove} disabled={removeLoading} className="flex-1 bg-destructive text-destructive-foreground">
                {removeLoading ? '...' : 'Deactivate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
