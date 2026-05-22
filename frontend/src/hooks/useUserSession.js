// Board-scoped session storage for public participants.
// Sessions are keyed by boardId so multiple boards can coexist.

export function getSession(boardId) {
  try {
    const raw = localStorage.getItem(`qs_session_${boardId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(boardId, sessionData) {
  localStorage.setItem(`qs_session_${boardId}`, JSON.stringify(sessionData))
  localStorage.setItem(`qs_token_${boardId}`, sessionData.session_token)
}

export function clearSession(boardId) {
  localStorage.removeItem(`qs_session_${boardId}`)
  localStorage.removeItem(`qs_token_${boardId}`)
}
