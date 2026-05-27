import publicAxios, { setPublicBoardId } from './publicAxiosInstance'

export { setPublicBoardId }

export const getPublicBoard = (boardId) => publicAxios.get(`/qna/${boardId}`)
export const getPublicQuestions = (boardId) => publicAxios.get(`/qna/${boardId}/questions`)
export const postPublicQuestion = (boardId, text, isAnonymous, displayName) =>
  publicAxios.post(`/qna/${boardId}/questions`, {
    text,
    ...(typeof isAnonymous === 'boolean' && { is_anonymous: isAnonymous }),
    ...(displayName && { display_name: displayName }),
  })
export const togglePublicLike = (boardId, qId) => publicAxios.patch(`/qna/${boardId}/questions/${qId}/like`)
export const trackPublicView = (boardId, qId) => publicAxios.patch(`/qna/${boardId}/questions/${qId}/view`)
export const editPublicQuestion = (boardId, qId, text) => publicAxios.patch(`/qna/${boardId}/questions/${qId}`, { text })
export const deletePublicQuestion = (boardId, qId) => publicAxios.delete(`/qna/${boardId}/questions/${qId}`)
