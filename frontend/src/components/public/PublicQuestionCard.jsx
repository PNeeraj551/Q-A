import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { togglePublicLike, editPublicQuestion, deletePublicQuestion } from '../../api/publicQna'

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

const pencilPath = 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10'
const trashPath = 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'
const thumbsUpPath = 'M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z'

export default function PublicQuestionCard({ question, boardId, isClosed, isNew, isTopQuestion, session, onUpdate, onDelete }) {
  const togglingRef = useRef(false)
  const editRef = useRef(null)
  const menuRef = useRef(null)
  const menuBtnRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })

  const isOwner = !!(session?.user_id && session.user_id === question.author_id)
  const answered = !!question.answered_in_slack
  const letter = (question.author_name || '?')[0].toUpperCase()
  const avatarColor = AVATAR_COLORS[letter.charCodeAt(0) % AVATAR_COLORS.length]
  const count = question.likes_count ?? 0
  const voted = question.liked_by_me ?? false

  useEffect(() => {
    if (editing && editRef.current) {
      const el = editRef.current
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editing])

  useEffect(() => {
    if (!menuOpen) return
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target) && !menuBtnRef.current?.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    function onScroll() { setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [menuOpen])

  function openMenu(e) {
    if (menuOpen) { setMenuOpen(false); return }
    const btn = e?.currentTarget || menuBtnRef.current
    if (btn) {
      const rect = btn.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setMenuOpen(true)
  }

  async function handleLike() {
    if (togglingRef.current || isClosed || question._isOptimistic) return
    togglingRef.current = true
    const wasLiked = voted
    const wasCount = count
    onUpdate({ ...question, liked_by_me: !wasLiked, likes_count: wasLiked ? wasCount - 1 : wasCount + 1 })
    try {
      const res = await togglePublicLike(boardId, question.id)
      onUpdate({ ...question, likes_count: res.data.likes_count, liked_by_me: res.data.liked_by_me })
    } catch {
      onUpdate({ ...question, liked_by_me: wasLiked, likes_count: wasCount })
      toast.error('Failed to update like')
    } finally {
      togglingRef.current = false
    }
  }

  function startEdit() {
    setMenuOpen(false)
    setEditText(question.text)
    setEditing(true)
  }

  async function handleSave() {
    const text = editText.trim()
    if (!text || saving) return
    setSaving(true)
    try {
      const res = await editPublicQuestion(boardId, question.id, text)
      onUpdate({ ...question, ...res.data.question })
      setEditing(false)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update question')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setMenuOpen(false)
    if (deleting) return
    setDeleting(true)
    try {
      await deletePublicQuestion(boardId, question.id)
      onDelete(question.id)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete question')
      setDeleting(false)
    }
  }

  const cardBorder = isTopQuestion ? 'border border-indigo-300 shadow-md border-l-4 border-l-indigo-500' : 'border border-slate-200 shadow-sm'
  const cardBg = isTopQuestion ? 'bg-indigo-50/30' : 'bg-white'

  return (
    <div className={`rounded-xl overflow-hidden ${cardBorder} ${cardBg} transition-all duration-200`}>
    <div className={`px-4 sm:px-6 py-4 group transition-opacity duration-150${answered ? ' opacity-75' : ''}${isNew ? ' animate-[fadeSlideIn_200ms_ease_out]' : ''}`}>

      {/* Zone 1 — header: avatar + name/time/badges + owner actions */}
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 ${avatarColor}`}>
          {letter}
        </div>

        <div className="flex-1 min-w-0">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-slate-800 leading-snug">{question.author_name || 'Anonymous'}</span>
              {question._isOptimistic && (
                <span className="text-xs text-slate-400 italic">Posting…</span>
              )}
              {answered && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs px-2 py-0.5 shrink-0">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Answered in Slack
                </span>
              )}
              {isTopQuestion && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-full text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 shrink-0">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                  <span className="md:hidden">Top</span>
                  <span className="hidden md:inline">Top Question</span>
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 leading-tight">{timeAgo(question.created_at)}</span>
          </div>
        </div>

        {/* Top-right: owner dots (slide-in on hover) + vote */}
        {!editing && (
          <div className="shrink-0">
            {/* Desktop pill */}
            <div className="hidden md:inline-flex items-center rounded-full border border-slate-200 bg-white shadow-sm overflow-hidden">
              {isOwner && !question._isOptimistic && (
                <div className="inline-flex items-center max-w-0 group-hover:max-w-[60px] overflow-hidden transition-all duration-200 ease-out">
                  <button
                    ref={menuBtnRef}
                    type="button"
                    onClick={openMenu}
                    aria-label="More options"
                    aria-haspopup="true"
                    aria-expanded={menuOpen}
                    className={[
                      'px-2.5 py-1.5 transition-colors duration-150',
                      menuOpen ? 'bg-slate-100 text-slate-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600',
                    ].join(' ')}
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                    </svg>
                  </button>
                  <div className="w-px h-5 bg-slate-200 shrink-0" />
                </div>
              )}
              <button
                type="button"
                onClick={!isClosed && !question._isOptimistic ? handleLike : undefined}
                disabled={isClosed || !!question._isOptimistic}
                aria-label={voted ? 'Remove like' : 'Like question'}
                aria-pressed={voted}
                className={[
                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors duration-150 select-none',
                  isClosed || question._isOptimistic ? 'text-slate-300 cursor-default font-semibold'
                    : voted || isTopQuestion ? 'text-indigo-600 font-bold hover:bg-slate-50'
                    : count > 0 ? 'text-blue-500 font-semibold hover:bg-slate-50'
                    : 'text-slate-500 font-semibold hover:bg-slate-50 hover:text-slate-700 active:bg-slate-100',
                ].join(' ')}
              >
                <span className="tabular-nums">{count}</span>
                <svg className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={thumbsUpPath} />
                </svg>
              </button>
            </div>
            {/* Mobile pill */}
            <div className="md:hidden inline-flex items-center rounded-full border border-slate-200 bg-white shadow-sm overflow-hidden">
              {isOwner && !question._isOptimistic && (
                <>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={openMenu}
                    aria-label="More options"
                    aria-haspopup="true"
                    aria-expanded={menuOpen}
                    className={[
                      'px-2.5 py-1.5 transition-colors duration-150',
                      menuOpen ? 'bg-slate-100 text-slate-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
                    ].join(' ')}
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                    </svg>
                  </button>
                  <div className="w-px h-5 bg-slate-200 shrink-0" />
                </>
              )}
              <button
                type="button"
                onClick={!isClosed && !question._isOptimistic ? handleLike : undefined}
                disabled={isClosed || !!question._isOptimistic}
                aria-label={voted ? 'Remove like' : 'Like question'}
                aria-pressed={voted}
                className={[
                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors duration-150 select-none',
                  isClosed || question._isOptimistic ? 'text-slate-300 cursor-default font-semibold'
                    : voted || isTopQuestion ? 'text-indigo-600 font-bold hover:bg-slate-50'
                    : count > 0 ? 'text-blue-500 font-semibold hover:bg-slate-50'
                    : 'text-slate-500 font-semibold hover:bg-slate-50 hover:text-slate-700 active:bg-slate-100',
                ].join(' ')}
              >
                <span className="tabular-nums">{count}</span>
                <svg className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={thumbsUpPath} />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Body — full width below header row */}
      {editing ? (
        <div className="mt-1 space-y-2">
          <textarea
            ref={editRef}
            rows={1}
            value={editText}
            onChange={(e) => {
              setEditText(e.target.value)
              const el = editRef.current
              if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
              if (e.key === 'Escape') setEditing(false)
            }}
            maxLength={5000}
            style={{ maxHeight: '40vh' }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[15px] text-slate-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 transition-all duration-150"
          />
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={saving || !editText.trim()} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} disabled={saving} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors duration-150">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap break-words">{question.text}</p>
      )}

      {/* Fixed dropdown menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="w-36 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden"
        >
          <button
            onClick={startEdit}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-100"
          >
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={pencilPath} />
            </svg>
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-100 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={trashPath} />
            </svg>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}
    </div>
    </div>
  )
}
