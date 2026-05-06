import axiosInstance from './axiosInstance'

export function login(email, password) {
  return axiosInstance.post('/auth/login', { email, password })
}

export function getMe() {
  return axiosInstance.get('/auth/me')
}

export function updateMe(payload) {
  return axiosInstance.patch('/auth/me', payload)
}

export function logout() {
  return axiosInstance.post('/auth/logout')
}

export function changePassword(currentPassword, newPassword) {
  return axiosInstance.patch('/auth/change-password', { currentPassword, newPassword })
}

export function adminResetPassword(userId) {
  return axiosInstance.patch(`/auth/admin-reset-password/${userId}`)
}

export function forgotPassword(email) {
  return axiosInstance.post('/auth/forgot-password', { email })
}

export function getResetRequests() {
  return axiosInstance.get('/auth/reset-requests')
}
