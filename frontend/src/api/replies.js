import axiosInstance from './axiosInstance'

export const listReplies = (qnaId, qId) =>
  axiosInstance.get(`/qna/${qnaId}/questions/${qId}/replies`)

export const createReply = (qnaId, qId, text) =>
  axiosInstance.post(`/qna/${qnaId}/questions/${qId}/replies`, { text })

export const updateReply = (qnaId, qId, rId, text) =>
  axiosInstance.patch(`/qna/${qnaId}/questions/${qId}/replies/${rId}`, { text })

export const deleteReply = (qnaId, qId, rId) =>
  axiosInstance.delete(`/qna/${qnaId}/questions/${qId}/replies/${rId}`)

export const toggleReplyLike = (qnaId, qId, rId) =>
  axiosInstance.patch(`/qna/${qnaId}/questions/${qId}/replies/${rId}/like`)
