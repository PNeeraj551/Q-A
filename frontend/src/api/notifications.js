import axiosInstance from './axiosInstance'

export function getNotifications() {
  return axiosInstance.get('/notifications')
}

export function markAsRead(id) {
  return axiosInstance.patch(`/notifications/${id}/read`)
}

export function markAllAsRead() {
  return axiosInstance.patch('/notifications/read-all')
}
