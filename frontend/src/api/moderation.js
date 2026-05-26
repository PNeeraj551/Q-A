import axiosInstance from './axiosInstance'

export const getModerationSummary  = () => axiosInstance.get('/admin/moderation/summary')
export const getSuspiciousActivity = () => axiosInstance.get('/admin/moderation/suspicious')
export const getAnonVotes          = (params) => axiosInstance.get('/admin/moderation/votes', { params })
export const voidVotesByToken      = (token) => axiosInstance.delete(`/admin/moderation/votes/token/${token}`)
export const voidVoteById          = (id) => axiosInstance.delete(`/admin/moderation/votes/${id}`)
