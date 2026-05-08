import axiosInstance from './axiosInstance'

export const listQna = (params = {}) => axiosInstance.get('/qna', { params })

export const getQna = (id) => axiosInstance.get(`/qna/${id}`)

export const createQna = (payload) => axiosInstance.post('/qna', payload)

export const updateQna = (id, payload) => axiosInstance.patch(`/qna/${id}`, payload)

export const deleteQna = (id) => axiosInstance.delete(`/qna/${id}`)

export const setQnaStatus = (id, status) => axiosInstance.patch(`/qna/${id}`, { status })

export const getQnaParticipants = (id) => axiosInstance.get(`/qna/${id}/participants`)

export const addQnaParticipant = (id, userId) =>
  axiosInstance.post(`/qna/${id}/participants`, { userId })

export const removeQnaParticipant = (id, userId) =>
  axiosInstance.delete(`/qna/${id}/participants/${userId}`)
