import { useState } from 'react'
import { createGroup } from '../api/collaboration'

export default function CreateGroupModal({ sessionId, currentUserId, presenceParticipants, onCreate, onClose }) {
  const [selectedIds, setSelectedIds] = useState([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const eligible = (presenceParticipants || []).filter(
    p => p.user_id?.toString() !== currentUserId?.toString() && p.role !== 'admin'
  )

  const totalMembers = selectedIds.length + 1
  const canCreate = selectedIds.length >= 1 && selectedIds.length <= 4 && !creating

  function toggleParticipant(userId) {
    setSelectedIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!canCreate) return
    setCreating(true)
    setError('')
    try {
      const res = await createGroup(sessionId, '', selectedIds)
      onCreate(res.data.group)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">New Collaboration Group</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-5 flex flex-col gap-4">
          {/* Participant selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Add Members
              </label>
              <span className={`text-xs font-medium ${totalMembers > 5 ? 'text-red-500' : 'text-slate-400'}`}>
                {totalMembers}/5
              </span>
            </div>
            {eligible.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No other participants online</p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
                {eligible.map(p => {
                  const checked = selectedIds.includes(p.user_id?.toString())
                  const wouldExceed = !checked && totalMembers >= 5
                  return (
                    <label
                      key={p.user_id}
                      className={`flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer ${
                        wouldExceed ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={wouldExceed}
                        onChange={() => toggleParticipant(p.user_id?.toString())}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {p.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm font-medium text-slate-800 truncate">{p.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canCreate}
              className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {creating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
