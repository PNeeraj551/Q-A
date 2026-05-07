import { useEffect, useRef, useState } from 'react'
import { participantGetChats, participantSendMessage } from '../api/adminDM'

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function AdminDMModal({ sessionId, socket, onClose }) {
  const [chats, setChats] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    participantGetChats(sessionId)
      .then(res => {
        const loaded = res.data.chats || []
        setChats(loaded)
        if (loaded.length === 1) setSelectedChat(loaded[0])
        setErrorMsg('')
      })
      .catch(() => setErrorMsg('Failed to load messages.'))
      .finally(() => setLoading(false))
  }, [sessionId])

  useEffect(() => {
    if (!socket) return

    function onNewChat(payload) {
      participantGetChats(sessionId)
        .then(res => {
          const loaded = res.data.chats || []
          setChats(loaded)
          if (loaded.length === 1) setSelectedChat(loaded[0])
        })
        .catch(() => {})
    }

    function onMessage(payload) {
      if (payload.sender_role !== 'admin') return
      const chatId = payload.chat_id?.toString()
      setSelectedChat(prev => {
        if (!prev || prev._id?.toString() !== chatId) return prev
        return { ...prev, messages: [...(prev.messages || []), payload] }
      })
      setChats(prev => prev.map(c =>
        c._id?.toString() === chatId
          ? { ...c, last_message: payload, message_count: (c.message_count || 0) + 1 }
          : c
      ))
    }

    socket.on('private:received', onNewChat)
    socket.on('private:message', onMessage)
    return () => {
      socket.off('private:received', onNewChat)
      socket.off('private:message', onMessage)
    }
  }, [socket, sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedChat?.messages])

  async function handleSend(e) {
    e.preventDefault()
    const text = msgText.trim()
    if (!text || sending || !selectedChat) return
    setSending(true)
    try {
      await participantSendMessage(sessionId, selectedChat._id, text)
      const optimisticMsg = { sender_role: 'participant', sender_name: 'You', text, sent_at: new Date().toISOString() }
      setSelectedChat(prev => prev ? { ...prev, messages: [...(prev.messages || []), optimisticMsg] } : prev)
      setMsgText('')
    } catch {
      setErrorMsg('Failed to send reply.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm h-[65vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {selectedChat && chats.length > 1 && (
              <button
                onClick={() => { setSelectedChat(null); setErrorMsg('') }}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors mr-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {selectedChat ? 'Private Message' : 'Messages from Host'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">From the session host</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !selectedChat ? (
          /* Chat list */
          <div className="flex-1 overflow-y-auto">
            {errorMsg ? (
              <p className="text-xs text-red-500 text-center py-8">{errorMsg}</p>
            ) : chats.length === 0 ? (
              <p className="text-xs text-slate-400 text-center pt-12">No messages from admin yet.</p>
            ) : (
              <div className="divide-y divide-slate-50 p-2">
                {chats.map(c => (
                  <button
                    key={c._id}
                    onClick={() => { setSelectedChat(c); setMsgText(''); setErrorMsg('') }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                      H
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">Host</p>
                      {c.last_message && (
                        <p className="text-xs text-slate-400 truncate">{c.last_message.text}</p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Message thread */
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {(!selectedChat.messages || selectedChat.messages.length === 0) ? (
                <p className="text-xs text-slate-400 text-center pt-8">No messages yet.</p>
              ) : (
                (selectedChat.messages || []).map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.sender_role === 'participant' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      msg.sender_role === 'participant'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}>
                      {msg.sender_role === 'admin' && (
                        <p className="text-[10px] font-bold mb-0.5 text-indigo-600">
                          {msg.sender_name || 'Host'}
                        </p>
                      )}
                      <p className="text-sm leading-snug whitespace-pre-wrap break-words">{msg.text}</p>
                    </div>
                    <p className={`text-[10px] mt-0.5 text-slate-400 ${msg.sender_role === 'participant' ? 'pr-1' : 'pl-1'}`}>
                      {formatTime(msg.sent_at)}
                    </p>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-slate-100 p-3 shrink-0">
              {errorMsg && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 mb-2">{errorMsg}</p>
              )}
              <form onSubmit={handleSend} className="flex gap-2">
                <textarea
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
                  maxLength={1000}
                  rows={2}
                  placeholder="Type a reply..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none transition-all"
                />
                <button
                  type="submit"
                  disabled={!msgText.trim() || sending}
                  className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl self-end transition-colors shrink-0"
                >
                  {sending
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                  }
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
