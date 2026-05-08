import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5300/api').replace('/api', '')

export function useQnaSocket(qnaId, { onQuestionNew, onReplyNew } = {}) {
  const socketRef = useRef(null)

  // Keep callbacks in refs so the effect never needs to re-run for them
  const onQuestionNewRef = useRef(onQuestionNew)
  const onReplyNewRef = useRef(onReplyNew)
  useEffect(() => { onQuestionNewRef.current = onQuestionNew })
  useEffect(() => { onReplyNewRef.current = onReplyNew })

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

    socket.on('question:new', (question) => {
      onQuestionNewRef.current?.(question)
    })

    socket.on('reply:new', (data) => {
      onReplyNewRef.current?.(data)
    })

    return () => {
      socket.emit('qna:leave', { qna_id: qnaId })
      socket.disconnect()
      socketRef.current = null
    }
  }, [qnaId])

  return socketRef
}
