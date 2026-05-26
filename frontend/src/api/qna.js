import axiosInstance from './axiosInstance'

export const listQna = (params = {}) => axiosInstance.get('/qna', { params })

export const getQna = (id) => axiosInstance.get(`/qna/${id}`)

export const createQna = (payload) => axiosInstance.post('/qna', payload)

export const updateQna = (id, payload) => axiosInstance.patch(`/qna/${id}`, payload)

export const deleteQna = (id) => axiosInstance.delete(`/qna/${id}`)

export const regenerateShareCode = (id) =>
  axiosInstance.post(`/qna/${id}/regenerate-code`)

export const updateJoinEnabled = (id, enabled) =>
  axiosInstance.patch(`/qna/${id}`, { join_enabled: enabled })
