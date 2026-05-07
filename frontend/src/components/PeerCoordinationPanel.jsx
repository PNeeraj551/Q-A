import { useEffect, useRef, useState } from 'react'
import { getCoordination, addNote, submitQuestion, closeCoordination } from '../api/peerCoordination'

export default function PeerCoordinationPanel({ coordinationId, peerName, currentUserId, socket, onClose }) {
  const [notes, setNotes] = useState([])
  const [status, setStatus] = useState('ACTIVE')
  const [noteText, setNoteText] = useState('')
  const [sendingNote, setSendingNote] = useState(false)
  const [composer, setComposer] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!coordinationId) return
    getCoordination(coordinationId)
      .then(res => {
        const c = res.data.coordination
        setNotes(c.notes || [])
        setStatus(c.status)
        setSubmitted(c.consolidated_question_submitted)
      })
      .catch(() => {})
  }, [coordinationId])

  useEffect(() => {
    if (!socket || !coordinationId) return
    socket.emit('peer:join_room', { coordination_id: coordinationId })

    function onNote(note) {
      setNotes(prev => [...prev, note])
    }
    function onSubmitted() { setSubmitted(true) }
    function onClosed() { setStatus('CLOSED') }

    socket.on('peer:note', onNote)
    socket.on('peer:question_submitted', onSubmitted)
    socket.on('peer:closed', onClosed)

    return () => {
      socket.emit('peer:leave_room', { coordination_id: coordinationId })
      socket.off('peer:note', onNote)
      socket.off('peer:question_submitted', onSubmitted)
      socket.off('peer:closed', onClosed)
    }
  }, [socket, coordinationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notes])

  async function handleSendNote() {
    if (!noteText.trim()) return
    setSendingNote(true)
    setError('')
    try {
      await addNote(coordinationId, noteText.trim())
      setNoteText('')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send')
    } finally {
      setSendingNote(false)
    }
  }

  async function handleSubmitQuestion() {
    if (!questionText.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await submitQuestion(coordinationId, questionText.trim())
      setComposer(false)
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleClose() {
    setClosing(true)
    try {
      await closeCoordination(coordinationId)
    } catch (_) {}
    setClosing(false)
    onClose()
  }

  const isClosed = status === 'CLOSED'

  return (
    <div className="fixed top-0 right-0 bottom-0 w-96 bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-slate-900">Peer Coordination</h2>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">With: <span className="font-semibold text-slate-700">{peerName}</span></span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${isClosed ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-slate-400' : 'bg-emerald-500'}`} />
            {isClosed ? 'Closed' : 'Active'}
          </span>
        </div>
      </div>

      {/* Purpose banner */}
      <div className="mx-4 mt-3 mb-2 px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl shrink-0">
        <p className="text-xs text-indigo-700 leading-relaxed">
          Use this space to compare doubts and refine one consolidated question for the session.
        </p>
      </div>

      {/* Notes thread */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {notes.length === 0 && (
          <p className="text-xs text-slate-400 text-center mt-6">No notes yet. Start coordinating below.</p>
        )}
        {notes.map((note, i) => {
          const isMine = note.sender_name === notes.find(n => n.sender_name)?.sender_name && i % 2 === 0
            ? false : false
          const time = note.sent_at ? new Date(note.sent_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''
          return (
            <div key={i} className="space-y-0.5">
              <p className="text-[11px] text-slate-400 font-medium">{note.sender_name} · {time}</p>
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                <p className="text-sm text-slate-800 leading-relaxed">{note.text}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input + actions */}
      {!isClosed && (
        <div className="px-4 py-3 border-t border-slate-100 space-y-2 shrink-0">
          {error && <p className="text-xs text-red-600">{error}</p>}

          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendNote() } }}
            placeholder="Type a coordination note..."
            rows={2}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 placeholder:text-slate-400"
          />

          <div className="flex gap-2">
            <button
              onClick={handleSendNote}
              disabled={sendingNote || !noteText.trim()}
              className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
            >
              {sendingNote ? 'Sending...' : 'Send Note'}
            </button>
            <button
              onClick={handleClose}
              disabled={closing}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              {closing ? '...' : 'Close'}
            </button>
          </div>

          {!submitted && !composer && (
            <button
              onClick={() => { setComposer(true); setQuestionText(notes.length > 0 ? notes[notes.length - 1].text : '') }}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5"
            >
              Submit Consolidated Public Question
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {submitted && (
            <div className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-center">
              Consolidated question submitted
            </div>
          )}

          {composer && !submitted && (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-600">Consolidated Question</p>
              <textarea
                value={questionText}
                onChange={e => setQuestionText(e.target.value)}
                placeholder="Type the consolidated question..."
                rows={3}
                className="w-full text-sm border border-indigo-300 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setComposer(false)}
                  className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitQuestion}
                  disabled={submitting || !questionText.trim()}
                  className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Publicly'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isClosed && (
        <div className="px-4 py-3 border-t border-slate-100 shrink-0">
          <p className="text-xs text-center text-slate-400">This coordination has been closed.</p>
        </div>
      )}
    </div>
  )
}
