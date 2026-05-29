import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/common/Button'
import { textareaCls } from '@/utils/ui'
import { getRelativeTime } from '@/utils/utils'
import { updateQuestion, deleteQuestion, toggleLike, markAnsweredInSlack, pushToSlack } from '../../api/questions'
import { InlineConfirm } from '../common/InlineConfirm'
import { QuestionActionPill } from './QuestionActionPill'
import toast from 'react-hot-toast'

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

const thumbsUpPath = 'M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z'

export function QuestionCard({ qnaId, question, currentUserId, isAdmin, isClosed, isTopQuestion, onUpdate, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const likingRef = useRef(false)
  const savingRef = useRef(false)
  const deletingRef = useRef(false)
  const markingSlackRef = useRef(false)
  const editRef = useRef(null)
  const menuRef = useRef(null)
  const menuBtnRef = useRef(null)
  const [editMode, setEditMode] = useState(false)
  const [editText, setEditText] = useState(question.text)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (editMode && editRef.current) {
      const el = editRef.current
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editMode])

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target) && !menuBtnRef.current?.contains(e.target)) setMenuOpen(false)
    }
    function handleScroll() { setMenuOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('scroll', handleScroll, true)
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
    if (likingRef.current || isClosed) return
    likingRef.current = true
    setTimeout(() => { likingRef.current = false }, 300)
    const optimistic = {
      ...question,
      liked_by_me: !question.liked_by_me,
      likes_count: question.liked_by_me ? question.likes_count - 1 : question.likes_count + 1,
    }
    onUpdate(optimistic)
    try {
      const res = await toggleLike(qnaId, question.id)
      onUpdate({ ...question, liked_by_me: res.data.liked_by_me, likes_count: res.data.likes_count })
    } catch {
      onUpdate(question)
    }
  }

  async function handleSaveEdit() {
    const text = editText.trim()
    if (!text || text === question.text || savingRef.current) { setEditMode(false); return }
    savingRef.current = true
    const original = question.text
    onUpdate({ ...question, text, pushed_to_slack: false })
    setEditMode(false)
    try {
      const res = await updateQuestion(qnaId, question.id, text)
      onUpdate(res.data.question)
      toast.success('Question updated.')
    } catch {
      onUpdate({ ...question, text: original })
      toast.error('Failed to update question.')
    } finally {
      savingRef.current = false
    }
  }

  async function handleDelete() {
    if (deletingRef.current) return
    deletingRef.current = true
    onDelete(question.id)
    try {
      await deleteQuestion(qnaId, question.id)
      toast.success('Question deleted.')
    } catch {
      toast.error('Failed to delete question.')
    }
  }

  async function handleMarkHandled() {
    if (markingSlackRef.current) return
    markingSlackRef.current = true
    try {
      const res = await markAnsweredInSlack(qnaId, question.id)
      onUpdate(res.data.question)
    } catch {
      toast.error('Failed to update question.')
    } finally {
      markingSlackRef.current = false
    }
  }

  async function handlePushSlack() {
    try {
      await pushToSlack(qnaId, question.id)
      onUpdate({ ...question, pushed_to_slack: true })
      toast.success('Pushed to Slack.')
    } catch {
      toast.error('Already pushed to Slack.')
    }
  }

  function handleEditFromMenu() {
    setMenuOpen(false)
    setEditMode(true)
    setEditText(question.text)
  }

  function handleDeleteFromMenu() {
    setMenuOpen(false)
    setConfirmDelete(true)
  }

  const canModify = question.author_id === currentUserId || isAdmin
  const answered = !!question.answered_in_slack
  const count = question.likes_count
  const voted = question.liked_by_me

  const initial = question.author_name?.[0]?.toUpperCase() || '?'
  const avatarColor = AVATAR_COLORS[initial.charCodeAt(0) % AVATAR_COLORS.length]

  const pencilPath = 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10'
  const trashPath = 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'
  const slackPath = 'M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.521-10.123a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z'

  const cardBorder = isTopQuestion
    ? 'border border-indigo-200 border-l-4 border-l-indigo-500 bg-indigo-50/40 shadow-sm'
    : 'border border-slate-200/80 bg-white hover:border-slate-300 shadow-sm'

  return (
    <div className={`rounded-2xl px-4 sm:px-6 py-4 group transition-all duration-200 ${cardBorder}${answered ? ' opacity-75' : ''}${question._isOptimistic ? ' opacity-60' : ''}`}>
      <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-2.5 sm:gap-x-3">
        {/* LEFT COLUMN: Avatar only */}
        <div className="col-start-1 flex justify-center pt-0.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 select-none ${avatarColor}`}>
            {initial}
          </div>
        </div>

        {/* RIGHT COLUMN: Author row, badges, content, actions */}
        <div className="col-start-2 min-w-0 flex flex-col">
          {/* Header Row: Author details + action pill */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-slate-800 leading-snug tracking-tight">{question.author_name}</span>
                {question._isOptimistic && (
                  <span className="text-xs text-slate-400 italic select-none">Posting…</span>
                )}
                {answered && (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs px-2 py-0.5 shrink-0 select-none">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Answered in Slack
                  </span>
                )}
                {isTopQuestion && (
                  <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-medium px-1.5 py-0.5 shrink-0 select-none">
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                    Top Voted
                  </span>
                )}
              </div>
              {question.created_at && (
                <span className="text-xs text-slate-400 leading-tight block mt-0.5 select-none">{getRelativeTime(question.created_at)}</span>
              )}
            </div>

            {/* Admin/owner actions — top right of header row */}
            {!editMode && !confirmDelete && (

              <div className="shrink-0">
                <QuestionActionPill
                  question={question}
                  isAdmin={isAdmin}
                  canModify={canModify}
                  onMarkHandled={handleMarkHandled}
                  onPushSlack={handlePushSlack}
                  menuBtnRef={menuBtnRef}
                  openMenu={openMenu}
                  menuOpen={menuOpen}
                  count={count}
                  voted={voted}
                  isClosed={isClosed}
                  isTopQuestion={isTopQuestion}
                  onVote={handleLike}
                />
              </div>
            )}
          </div>

          {/* Body text OR inline edit composer — both inside col-2 for consistent alignment */}
          {editMode ? (
            <div className="mt-2 space-y-2">
              <textarea
                ref={editRef}
                className="w-full bg-slate-50 hover:bg-slate-50 focus:bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-[15px] text-slate-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-150"
                rows={1}
                style={{ maxHeight: '40vh' }}
                value={editText}
                onChange={(e) => {
                  setEditText(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit() }
                  if (e.key === 'Escape') { setEditMode(false); setEditText(question.text) }
                }}
                maxLength={5000}
              />
              <div className="flex items-center gap-3 select-none">
                <button
                  onClick={handleSaveEdit}
                  disabled={!editText.trim()}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditMode(false); setEditText(question.text) }}
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap break-words">{question.text}</p>
              {confirmDelete && (
                <div className="mt-2.5 select-none">
                  <InlineConfirm onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fixed dropdown menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden select-none"
        >
          {isAdmin && (
            <div className="md:hidden">
              <button
                onClick={() => { setMenuOpen(false); handleMarkHandled() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-100"
              >
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {answered ? 'Remove Answer' : 'Mark as Answered'}
              </button>
              <button
                onClick={() => { if (!question.pushed_to_slack) { setMenuOpen(false); handlePushSlack() } }}
                disabled={!!question.pushed_to_slack}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d={slackPath} />
                </svg>
                {question.pushed_to_slack ? 'Pushed to Slack' : 'Push to Slack'}
              </button>
              {canModify && <div className="mx-3 my-1 border-t border-slate-100" />}
            </div>
          )}
          {question.author_id === currentUserId && (
            <button onClick={handleEditFromMenu} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-100">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={pencilPath} />
              </svg>
              Edit
            </button>
          )}
          <button onClick={handleDeleteFromMenu} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-100">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={trashPath} />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
