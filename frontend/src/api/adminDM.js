import axiosInstance from './axiosInstance'

export const getSessionChats = (sessionId) =>
  axiosInstance.get(`/admin/dm/${sessionId}`)

export const createChat = (sessionId, participant_ids) =>
  axiosInstance.post(`/admin/dm/${sessionId}`, { participant_ids })

export const adminSendMessage = (chatId, text) =>
  axiosInstance.post(`/admin/dm/${chatId}/message`, { text })

export const participantGetChats = (sessionId) =>
  axiosInstance.get(`/sessions/${sessionId}/admin-dm`)

export const participantSendMessage = (sessionId, chat_id, text) =>
  axiosInstance.post(`/sessions/${sessionId}/admin-dm/reply`, { chat_id, text })
