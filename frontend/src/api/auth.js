import axiosInstance from './axiosInstance'

export function login(email, password) {
  return axiosInstance.post('/auth/login', { email, password })
}

export function getMe() {
  return axiosInstance.get('/auth/me')
}

export function logout() {
  return axiosInstance.post('/auth/logout')
}
