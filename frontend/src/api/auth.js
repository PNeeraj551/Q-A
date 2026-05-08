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
