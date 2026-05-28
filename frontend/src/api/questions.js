import axiosInstance from './axiosInstance'

export const listQuestions = (qnaId) =>
  axiosInstance.get(`/qna/${qnaId}/questions`)

export const createQuestion = (qnaId, text) =>
  axiosInstance.post(`/qna/${qnaId}/questions`, { text })

export const updateQuestion = (qnaId, qId, text) =>
  axiosInstance.patch(`/qna/${qnaId}/questions/${qId}`, { text })

export const deleteQuestion = (qnaId, qId) =>
  axiosInstance.delete(`/qna/${qnaId}/questions/${qId}`)

export const toggleLike = (qnaId, qId) =>
  axiosInstance.patch(`/qna/${qnaId}/questions/${qId}/like`)

export const acceptReply = (qnaId, qId, replyId) =>
  axiosInstance.patch(`/qna/${qnaId}/questions/${qId}/accept-reply`, { reply_id: replyId ?? null })

export const trackView = (qnaId, qId) =>
  axiosInstance.patch(`/qna/${qnaId}/questions/${qId}/view`)

export const markAnsweredInSlack = (qnaId, qId) =>
  axiosInstance.patch(`/qna/${qnaId}/questions/${qId}/slack-answer`)

export const pushToSlack = (qnaId, qId) =>
  axiosInstance.post(`/qna/${qnaId}/questions/${qId}/push-slack`)

export const pinQuestion = (qnaId, qId) =>
  axiosInstance.patch(`/qna/${qnaId}/questions/${qId}/pin`)
