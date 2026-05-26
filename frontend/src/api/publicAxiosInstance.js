import axios from 'axios'

let _boardId = null

export function setPublicBoardId(boardId) {
  _boardId = boardId
}

const publicAxios = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
})

publicAxios.interceptors.request.use((config) => {
  if (_boardId) {
    const token = localStorage.getItem(`qs_token_${_boardId}`)
    if (token) config.headers['X-Session-Token'] = token
  }
  if (config.method === 'patch') {
    config.headers['X-Request-Timestamp'] = String(Date.now())
  }
  return config
})

export default publicAxios
