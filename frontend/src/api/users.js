import axiosInstance from './axiosInstance'

export function searchUsers(query = '') {
  return axiosInstance.get('/users', { params: { search: query } })
}
