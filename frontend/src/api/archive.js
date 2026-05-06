import api from './axiosInstance';

/**
 * Fetch archived (CLOSED) sessions with optional filters.
 * @param {Object} params - Query parameters (title, from, to, access_type, participant, page, limit)
 */
export const searchArchivedSessions = (params) => {
  return api.get('/archive/sessions', { params });
};

/**
 * Fetch a specific archived session by ID.
 * @param {string} sessionId 
 */
export const getArchivedSessionById = (sessionId) => {
  return api.get(`/archive/sessions/${sessionId}`);
};

/**
 * Fetch comments for a specific archived session.
 * @param {string} sessionId 
 * @param {Object} params - Query parameters (page, limit)
 */
export const getArchivedSessionComments = (sessionId, params) => {
  return api.get(`/archive/sessions/${sessionId}/comments`, { params });
};
