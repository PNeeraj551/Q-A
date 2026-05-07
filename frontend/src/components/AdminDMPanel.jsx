import { useEffect, useRef, useState } from 'react'
import { getSessionChats, createChat, adminSendMessage } from '../api/adminDM'

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function AdminDMPanel({ sessionId, socket, presenceParticipants = [], onClose }) {
  const [chats, setChats] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    getSessionChats(sessionId)
      .then(res => { setChats(res.data.chats || []); setErrorMsg('') })
      .catch(() => setErrorMsg('Failed to load chats.'))
      .finally(() => setLoading(false))
  }, [sessionId])

  useEffect(() => {
    if (!socket) return
    function onMessage(payload) {
      if (payload.sender_role !== 'participant') return
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
    socket.on('private:message', onMessage)
    return () => socket.off('private:message', onMessage)
  }, [socket])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedChat?.messages])

  async function openChat(chat) {
    setMsgText('')
    setErrorMsg('')
    setSelectedChat(chat)
  }

  async function handleSend(e) {
    e.preventDefault()
    const text = msgText.trim()
    if (!text || sending || !selectedChat) return
    setSending(true)
    try {
      const res = await adminSendMessage(selectedChat._id, text)
      setSelectedChat(res.data.chat)
      setChats(prev => prev.map(c => c._id === res.data.chat._id ? {
        ...c,
        last_message: res.data.chat.messages[res.data.chat.messages.length - 1],
        message_count: res.data.chat.messages.length,
      } : c))
      setMsgText('')
    } catch {
      setErrorMsg('Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  async function handleCreateChat() {
    if (selectedIds.length === 0) return
    setCreating(true)
    setErrorMsg('')
    try {
      const res = await createChat(sessionId, selectedIds)
      const newChat = res.data.chat
      setChats(prev => [newChat, ...prev])
      setSelectedIds([])
      setShowNewChat(false)
      setSelectedChat(newChat)
    } catch (err) {
      const msg = err.response?.data?.message
      setErrorMsg(msg || 'Failed to create chat.')
    } finally {
      setCreating(false)
    }
  }

  function toggleParticipant(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    )
  }

  const chatTitle = selectedChat
    ? selectedChat.participants?.map(p => p.name).join(', ') || 'Chat'
    : 'Private Chats'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md h-[75vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {(selectedChat || showNewChat) && (
              <button
                onClick={() => { setSelectedChat(null); setShowNewChat(false); setErrorMsg('') }}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors mr-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-sm font-bold text-slate-900 truncate max-w-[220px]">
                {showNewChat ? 'New Chat' : chatTitle}
              </h2>
              {!selectedChat && !showNewChat && (
                <p className="text-xs text-slate-400 mt-0.5">Private message participants</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!selectedChat && !showNewChat && (
              <button
                onClick={() => { setShowNewChat(true); setSelectedIds([]); setErrorMsg('') }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors mr-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {showNewChat ? (
          /* New chat participant selector */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-3 pb-2">
              <p className="text-xs text-slate-500">Select up to 4 participants to start a private chat.</p>
              {errorMsg && <p className="text-xs text-red-500 mt-1">{errorMsg}</p>}
            </div>
            <div className="flex-1 overflow-y-auto px-3">
              {presenceParticipants.filter(p => p.role !== 'admin').length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No participants online.</p>
              ) : (
                presenceParticipants.filter(p => p.role !== 'admin').map(p => {
                  const selected = selectedIds.includes(p.user_id)
                  return (
                    <button
                      key={p.user_id}
                      onClick={() => toggleParticipant(p.user_id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-colors text-left ${
                        selected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        selected ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {p.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm text-slate-800 font-medium flex-1">{p.name}</span>
                      {selected && (
                        <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )
                })
              )}
            </div>
            <div className="p-3 border-t border-slate-100 shrink-0">
              <button
                onClick={handleCreateChat}
                disabled={selectedIds.length === 0 || creating}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {creating
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : `Start Chat${selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}`
                }
              </button>
            </div>
          </div>
        ) : !selectedChat ? (
          /* Chat list */
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : errorMsg ? (
              <p className="text-xs text-red-500 text-center py-8 px-4">{errorMsg}</p>
            ) : chats.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-600">No chats yet</p>
                <p className="text-xs text-slate-400 mt-1">Click "New Chat" to message participants privately</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 p-2">
                {chats.map(c => (
                  <button
                    key={c._id}
                    onClick={() => openChat(c)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {c.participants?.[0]?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {c.participants?.map(p => p.name).join(', ') || 'Chat'}
                      </p>
                      {c.last_message && (
                        <p className="text-xs text-slate-400 truncate">
                          {c.last_message.sender_role === 'admin' ? 'You: ' : `${c.last_message.sender_name}: `}
                          {c.last_message.text}
                        </p>
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
          /* Chat view */
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {(!selectedChat.messages || selectedChat.messages.length === 0) && (
                <p className="text-xs text-slate-400 text-center pt-8">No messages yet. Start the conversation.</p>
              )}
              {(selectedChat.messages || []).map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.sender_role === 'admin' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    msg.sender_role === 'admin'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}>
                    {msg.sender_role === 'participant' && (
                      <p className="text-[10px] font-bold mb-0.5 text-indigo-600">{msg.sender_name}</p>
                    )}
                    <p className="text-sm leading-snug whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                  <p className={`text-[10px] mt-0.5 text-slate-400 ${msg.sender_role === 'admin' ? 'pr-1' : 'pl-1'}`}>
                    {formatTime(msg.sent_at)}
                  </p>
                </div>
              ))}
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
                  placeholder="Type a private message..."
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
