import axios from 'axios'

const axiosInstance = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

let isRefreshing = false
let failedQueue = []

function processQueue(err, token) {
  failedQueue.forEach(p => (err ? p.reject(err) : p.resolve(token)))
  failedQueue = []
}

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axiosInstance.interceptors.response.use(
  (response) => response,
  async (err) => {
    const original = err.config

    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return axiosInstance(original)
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        const newToken = data.access_token
        localStorage.setItem('jwt', newToken)
        processQueue(null, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return axiosInstance(original)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        localStorage.removeItem('jwt')
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    if (err.response?.status === 429) {
      err.response.data = err.response.data || {}
      err.response.data.message = 'Too many requests. Try again later after a few minutes.'
    }

    return Promise.reject(err)
  }
)

export default axiosInstance
