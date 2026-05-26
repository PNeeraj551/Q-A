import axiosInstance from './axiosInstance'

export const getUsers = (search) =>
  axiosInstance.get('/admin/users', { params: search ? { search } : {} })

export const createUser = (data) =>
  axiosInstance.post('/admin/users', data)

export const updateUser = (id, data) =>
  axiosInstance.patch(`/admin/users/${id}`, data)

export const unlockUser = (id) =>
  axiosInstance.post(`/admin/users/${id}/unlock`)

export const deleteUser = (id) =>
  axiosInstance.delete(`/admin/users/${id}`)
