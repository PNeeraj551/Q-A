import axios from 'axios'

// Axios instance for public board participants.
// Injects X-Session-Token from localStorage keyed by boardId.
// Call setPublicBoardId(boardId) before making requests.

let _boardId = null

export function setPublicBoardId(boardId) {
  _boardId = boardId
}

const publicAxios = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

publicAxios.interceptors.request.use((config) => {
  if (_boardId) {
    const token = localStorage.getItem(`qs_token_${_boardId}`)
    if (token) config.headers['X-Session-Token'] = token
  }
  return config
})

export default publicAxios
