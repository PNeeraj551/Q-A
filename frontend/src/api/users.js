import axiosInstance from './axiosInstance'

export const getUsers = (search = '') =>
  axiosInstance.get('/users', { params: search ? { search } : {} })

export const createUser = (payload) => axiosInstance.post('/users', payload)

export const updateUser = (id, payload) => axiosInstance.patch(`/users/${id}`, payload)

export const deleteUser = (id) => axiosInstance.delete(`/users/${id}`)
