import { useEffect, useRef } from 'react'
import supabase from '../utils/supabase'

export function useQnaRealtime(qnaId, {
  onQuestionNew,
  onQuestionUpdate,
  onQuestionDelete,
  onQuestionLike,
  onReplyNew,
  onReplyDelete,
  onQnaUpdate,
} = {}) {
  const cbRefs = useRef({})
  useEffect(() => {
    cbRefs.current = { onQuestionNew, onQuestionUpdate, onQuestionDelete, onQuestionLike, onReplyNew, onReplyDelete, onQnaUpdate }
  })

  useEffect(() => {
    if (!qnaId) return

    const channel = supabase
      .channel(`qna_${qnaId}`)
      .on('broadcast', { event: 'question:new' },    ({ payload }) => cbRefs.current.onQuestionNew?.(payload))
      .on('broadcast', { event: 'question:update' }, ({ payload }) => cbRefs.current.onQuestionUpdate?.(payload))
      .on('broadcast', { event: 'question:delete' }, ({ payload }) => cbRefs.current.onQuestionDelete?.(payload))
      .on('broadcast', { event: 'question:like' },   ({ payload }) => cbRefs.current.onQuestionLike?.(payload))
      .on('broadcast', { event: 'reply:new' },       ({ payload }) => cbRefs.current.onReplyNew?.(payload))
      .on('broadcast', { event: 'reply:delete' },    ({ payload }) => cbRefs.current.onReplyDelete?.(payload))
      .on('broadcast', { event: 'qna:updated' },     ({ payload }) => cbRefs.current.onQnaUpdate?.(payload))
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [qnaId])
}
