import axiosInstance from './axiosInstance'

export function getSessions(params = {}) {
  return axiosInstance.get('/sessions', { params })
}

export function getSessionById(id) {
  return axiosInstance.get(`/sessions/${id}`)
}

export function createSession(data) {
  return axiosInstance.post('/sessions', data)
}

export function updateSession(id, data) {
  return axiosInstance.patch(`/sessions/${id}`, data)
}

export function deleteSession(id) {
  return axiosInstance.delete(`/sessions/${id}`)
}

export function updateSessionStatus(id, status) {
  return axiosInstance.patch(`/sessions/${id}/status`, { status })
}

export function getSessionParticipants(id) {
  return axiosInstance.get(`/sessions/${id}/participants`)
}

export function addSessionParticipant(id, user_id) {
  return axiosInstance.post(`/sessions/${id}/participants`, { user_id })
}

export function removeSessionParticipant(id, userId) {
  return axiosInstance.delete(`/sessions/${id}/participants/${userId}`)
}
