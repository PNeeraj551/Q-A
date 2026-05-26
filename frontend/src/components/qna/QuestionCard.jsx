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

export function QuestionCard({ qnaId, question, currentUserId, isAdmin, isClosed, onUpdate, onDelete }) {
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

  function openMenu() {
    if (menuOpen) { setMenuOpen(false); return }
    if (menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect()
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
    onUpdate({ ...question, text })
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
    await pushToSlack(qnaId, question.id)
    toast.success('Pushed to Slack.')
  }

  function handleCopy() {
    setMenuOpen(false)
    navigator.clipboard.writeText(question.text)
    toast.success('Copied to clipboard')
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

  const initial = question.author_name?.[0]?.toUpperCase() || '?'
  const avatarColor = AVATAR_COLORS[initial.charCodeAt(0) % AVATAR_COLORS.length]

  const pencilPath = 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10'
  const trashPath = 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'

  return (
    <div className={`px-6 py-4 group transition-opacity duration-150${answered ? ' opacity-75' : ''}${question._isOptimistic ? ' opacity-60' : ''}`}>

      {/* ── Header row: avatar + name/time + action pill ── */}
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor}`}>
          {initial}
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-0">
          <span className="text-sm font-semibold text-slate-800 truncate leading-snug">{question.author_name}</span>
          {question.created_at && (
            <>
              <span className="mx-1.5 text-slate-300 text-xs select-none">·</span>
              <span className="text-xs text-slate-400 whitespace-nowrap">{getRelativeTime(question.created_at)}</span>
            </>
          )}
          {question._isOptimistic && (
            <span className="ml-2 text-xs text-slate-400 italic">Posting…</span>
          )}
        </div>

        {/* Action pill — hidden in edit/delete confirm modes */}
        {!editMode && !confirmDelete && (
          <QuestionActionPill
            question={question}
            isAdmin={isAdmin}
            isClosed={isClosed}
            canModify={canModify}
            onVote={handleLike}
            onMarkHandled={handleMarkHandled}
            onPushSlack={handlePushSlack}
            menuBtnRef={menuBtnRef}
            openMenu={openMenu}
            menuOpen={menuOpen}
          />
        )}
      </div>

      {/* ── Body: text + badges + edit ── */}
      <div className="mt-1.5 pl-11">
        {editMode ? (
          <div className="space-y-2">
            <textarea
              ref={editRef}
              className={textareaCls}
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
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditMode(false); setEditText(question.text) }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap break-words">{question.text}</p>
        )}

        {/* Answered badge */}
        {answered && !editMode && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Answered in Slack
            </span>
          </div>
        )}

        {/* Inline delete confirm */}
        {confirmDelete && (
          <div className="mt-2">
            <InlineConfirm onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />
          </div>
        )}
      </div>

      {/* ── Fixed dropdown menu ── */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden"
        >

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
