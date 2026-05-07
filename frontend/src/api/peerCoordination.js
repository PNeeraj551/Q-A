import axiosInstance from './axiosInstance'
const api = axiosInstance

export const startCoordination = (session_id, target_id) =>
  api.post('/peer-coordination', { session_id, target_id })

export const listBySession = (sessionId) =>
  api.get(`/peer-coordination/session/${sessionId}`)

export const getCoordination = (id) =>
  api.get(`/peer-coordination/${id}`)

export const addNote = (id, text) =>
  api.post(`/peer-coordination/${id}/note`, { text })

export const submitQuestion = (id, question_text) =>
  api.post(`/peer-coordination/${id}/submit-question`, { question_text })

export const closeCoordination = (id) =>
  api.patch(`/peer-coordination/${id}/close`)

export const getPresence = (sessionId) =>
  api.get(`/sessions/${sessionId}/presence`)
