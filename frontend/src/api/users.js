import axiosInstance from './axiosInstance'

export function searchUsers(query = '') {
  return axiosInstance.get('/users', { params: { search: query } })
}

export function getUsers(query = '') {
  return axiosInstance.get('/users', { params: query ? { search: query } : {} })
}

export function createUser(data) {
  return axiosInstance.post('/users', data)
}

export function deactivateUser(id) {
  return axiosInstance.delete(`/users/${id}`)
}

export function updateUser(id, data) {
  return axiosInstance.patch(`/users/${id}`, data)
}
