const apiUrl = import.meta.env.VITE_API_URL || ''
export const SOCKET_URL = apiUrl.replace(/\/api$/, '') || '/'
