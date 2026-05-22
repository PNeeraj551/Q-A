// Public board API — uses X-Session-Token header for authenticated calls.
// Mirror of the admin API but scoped for public participants.
import publicAxios, { setPublicBoardId } from './publicAxiosInstance'

export { setPublicBoardId }

export const getPublicBoard = (boardId) => publicAxios.get(`/qna/${boardId}`)
export const getPublicQuestions = (boardId) => publicAxios.get(`/qna/${boardId}/questions`)
export const postPublicQuestion = (boardId, text) => publicAxios.post(`/qna/${boardId}/questions`, { text })
export const getPublicReplies = (boardId, qId) => publicAxios.get(`/qna/${boardId}/questions/${qId}/replies`)
export const postPublicReply = (boardId, qId, text) => publicAxios.post(`/qna/${boardId}/questions/${qId}/replies`, { text })
export const togglePublicLike = (boardId, qId) => publicAxios.patch(`/qna/${boardId}/questions/${qId}/like`)
export const togglePublicReplyLike = (boardId, qId, rId) => publicAxios.patch(`/qna/${boardId}/questions/${qId}/replies/${rId}/like`)
export const trackPublicView = (boardId, qId) => publicAxios.patch(`/qna/${boardId}/questions/${qId}/view`)
