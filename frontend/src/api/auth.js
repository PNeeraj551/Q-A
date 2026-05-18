import axiosInstance from './axiosInstance'

export function requestOtp(email) {
  return axiosInstance.post('/auth/request-otp', { email })
}

export function verifyOtp(email, otp) {
  return axiosInstance.post('/auth/verify-otp', { email, otp })
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
