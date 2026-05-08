import axios from 'axios'

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axiosInstance.interceptors.response.use(
  (response) => response,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('jwt')
      window.location.href = '/login'
    }

    if (err.response?.status === 429) {
      err.response.data = err.response.data || {}
      err.response.data.message = 'Too many requests. Try again later after a few minutes.'
    }

    return Promise.reject(err)
  }
)

export default axiosInstance
