import axios from 'axios'

const base = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

export const getBoardPreview = (shareCode) =>
  base.get(`/join/${shareCode}`)

export const requestJoinOtp = (shareCode, email) =>
  base.post(`/join/${shareCode}/otp`, { email })

export const verifyJoinOtp = (shareCode, email, otp) =>
  base.post(`/join/${shareCode}/verify`, { email, otp })

export const setAnonymous = (shareCode, sessionToken) =>
  base.patch(`/join/${shareCode}/anonymous`, {}, {
    headers: { 'X-Session-Token': sessionToken },
  })
