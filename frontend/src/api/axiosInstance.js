import axios from 'axios'

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

const cache = new Map()
const CACHE_TTL = 30_000
const MUTATIONS = new Set(['post', 'patch', 'put', 'delete'])

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (config.method === 'get') {
    const key = config.url + JSON.stringify(config.params || {})
    const hit = cache.get(key)
    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      config.adapter = () => Promise.resolve({ ...hit.response, config })
    }
  }

  return config
})

axiosInstance.interceptors.response.use(
  (response) => {
    if (response.config.method === 'get') {
      const key = response.config.url + JSON.stringify(response.config.params || {})
      cache.set(key, { response, ts: Date.now() })
    } else if (MUTATIONS.has(response.config.method)) {
      cache.clear()
    }
    return response
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('jwt')
      window.dispatchEvent(new Event('auth:unauthorized'))
    }

    if (err.response?.status === 429) {
      err.response.data = err.response.data || {}
      err.response.data.message = 'Too many requests. Try again later after a few minutes.'
    }

    if (err.config && MUTATIONS.has(err.config.method)) {
      cache.clear()
    }

    return Promise.reject(err)
  }
)

export default axiosInstance
