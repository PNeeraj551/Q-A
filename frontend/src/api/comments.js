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

export function editComment(commentId, comment_text) {
  return axiosInstance.patch(`/comments/${commentId}/edit`, { comment_text })
}

export function removeComment(commentId) {
  return axiosInstance.patch(`/comments/${commentId}/remove`)
}

export function likeComment(commentId) {
  return axiosInstance.patch(`/comments/${commentId}/like`)
}
