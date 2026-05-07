import axiosInstance from './axiosInstance'

export const getPostSessionAnalytics = (sessionId) =>
  axiosInstance.get(`/admin/session-analytics/${sessionId}`)

export const getOverviewAnalytics = () =>
  axiosInstance.get('/admin/analytics/overview')

export const getSessionDetailAnalytics = (sessionId) =>
  axiosInstance.get(`/admin/analytics/session/${sessionId}`)
