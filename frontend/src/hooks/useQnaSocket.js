import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5300/api').replace('/api', '')

export function useQnaSocket(qnaId, {
  onQuestionNew,
  onQuestionUpdate,
  onQuestionDelete,
  onQuestionLike,
  onReplyNew,
  onReplyDelete,
  onQnaUpdate,
} = {}) {
  const socketRef = useRef(null)

  const cbRefs = useRef({})
  useEffect(() => {
    cbRefs.current = { onQuestionNew, onQuestionUpdate, onQuestionDelete, onQuestionLike, onReplyNew, onReplyDelete, onQnaUpdate }
  })

  useEffect(() => {
    if (!qnaId) return

    const token = localStorage.getItem('jwt')
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('qna:join', { qna_id: qnaId })
    })

    socket.on('question:new',    (data) => cbRefs.current.onQuestionNew?.(data))
    socket.on('question:update', (data) => cbRefs.current.onQuestionUpdate?.(data))
    socket.on('question:delete', (data) => cbRefs.current.onQuestionDelete?.(data))
    socket.on('question:like',   (data) => cbRefs.current.onQuestionLike?.(data))
    socket.on('reply:new',       (data) => cbRefs.current.onReplyNew?.(data))
    socket.on('reply:delete',    (data) => cbRefs.current.onReplyDelete?.(data))
    socket.on('qna:update',      (data) => cbRefs.current.onQnaUpdate?.(data))

    return () => {
      socket.emit('qna:leave', { qna_id: qnaId })
      socket.disconnect()
      socketRef.current = null
    }
  }, [qnaId])

  return socketRef
}
