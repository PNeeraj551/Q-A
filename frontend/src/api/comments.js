import axiosInstance from './axiosInstance'

export function getComments(sessionId, params = {}) {
  return axiosInstance.get(`/sessions/${sessionId}/comments`, { params })
}

export function createComment(sessionId, comment_text, parent_id = null) {
  const body = { comment_text }
  if (parent_id) body.parent_id = parent_id
  return axiosInstance.post(`/sessions/${sessionId}/comments`, body)
}

export function hideComment(commentId) {
  return axiosInstance.patch(`/comments/${commentId}/hide`)
}

export function deleteComment(commentId) {
  return axiosInstance.patch(`/comments/${commentId}/delete`)
}

export function pinComment(commentId) {
  return axiosInstance.patch(`/comments/${commentId}/pin`)
}

export function likeComment(commentId) {
  return axiosInstance.patch(`/comments/${commentId}/like`)
}
