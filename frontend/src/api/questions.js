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
